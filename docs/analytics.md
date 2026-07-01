# Analytics

This document describes Snip's click-analytics system end to end: the API surface, the write pipeline from click to durable storage, the caching strategy, and known limitations.

## Contents

- [Overview](#overview)
- [API Endpoints](#api-endpoints)
- [Query Parameters](#query-parameters)
- [Write Pipeline](#write-pipeline)
- [Read Path](#read-path)
- [Caching & Invalidation](#caching--invalidation)
- [Unique Visitor Counting](#unique-visitor-counting)
- [The Separate `ShortUrl.clicks` Counter](#the-separate-shorturlclicks-counter)
- [Known Gaps / Accepted Risk](#known-gaps--accepted-risk)

---

## Overview

Every redirect (`GET /:shortId`) generates a click event that flows async through a queue, gets aggregated in Redis, and is periodically flushed into a pre-aggregated MongoDB collection (`ClickBucket` — one document per URL per day). Analytics reads are served from a mix of that MongoDB history and a live read of "today's" still-unflushed Redis data, so recent activity shows up without waiting for the next flush.

All analytics endpoints require authentication and are scoped to the requesting user's own URLs — there's no cross-user or public analytics access.

## API Endpoints

All routes are under `/api/analytics` and require a valid access token (`authMiddleware`) plus pass through `authenticatedApiLimiter` (100 req/min per user).

**Per-URL** (owner-scoped — 404s if the URL doesn't exist or isn't owned by the caller):

| Method | Path | Returns |
|---|---|---|
| `GET` | `/summary/:id` | `{ urlId, shortUrl, fullUrl, range, total, uniqueVisitors }` |
| `GET` | `/timeseries/:id` | `[{ date, total, uniqueVisitors }, ...]` — one point per day in range |
| `GET` | `/breakdown/:id` | `[{ name, count }, ...]` — top values for one dimension, sorted descending |

**Overall** (aggregated across every URL owned by the caller):

| Method | Path | Returns |
|---|---|---|
| `GET` | `/summary` | `{ total, uniqueVisitors, range, topUrl }` |
| `GET` | `/timeseries` | `[{ date, total, uniqueVisitors }, ...]` |
| `GET` | `/breakdown` | `[{ name, count }, ...]` |
| `GET` | `/leaderboard` | `[{ urlId, shortUrl, fullUrl, clicks }, ...]` — top URLs by clicks in range |

All responses are wrapped identically: `{ success: true, data: <above> }` (`toAnalyticsResponseDTO`).

## Query Parameters

| Param | Applies to | Values | Default | Notes |
|---|---|---|---|---|
| `range` | all endpoints | `7d`, `30d`, `90d` | `30d` | Anything else → `400 ANALYTICS_INVALID_RANGE`. |
| `by` | breakdown endpoints | `countries`, `devices`, `browsers`, `os`, `referers`, `hours` | — (required) | Anything else → `400 ANALYTICS_INVALID_BREAKDOWN`. |
| `limit` | leaderboard | integer | `10` | Capped at `50` server-side (`Math.min(limit, 50)`) regardless of what's requested, so a client can't force an oversized query. |

## Write Pipeline

```
GET /:shortId  (visitor clicks a link)
   │
   ├─ recordClick(urlId, ttlDays, req) — fire-and-forget from the visitor's
   │  perspective. Extracts referer hostname (falls back to "direct" on a
   │  missing/malformed Referer header), then enqueues a BullMQ job on the
   │  "clicks" queue with { urlId, ip, userAgent, referer, timestamp }.
   │  A failure here is caught and logged, not surfaced — a broken redirect
   │  over a lost analytics event is the wrong trade-off.
   │
   ▼
clickWorker.js  (BullMQ worker, concurrency 10, dedicated ioredis connection)
   │
   └─ processClick(data):
        - Parses the User-Agent string (device/browser/OS) via ua-parser-js.
        - Derives a visitor identifier: sha256(ip + ":" + userAgent).
        - Extracts the click's date (YYYY-MM-DD) and hour (00–23) from timestamp.
        - saveClickToRedis(): one Redis MULTI pipeline, atomic —
            HINCRBY analytics:{urlId}:{date}   total, country:*, device:*,
                                                 browser:*, os:*, referer:*, hour:*
            PFADD   analytics:{urlId}:{date}:visitors   visitorHash
            EXPIRE  (NX) both keys → 48h
            SADD    analytics:active   analytics:{urlId}:{date}
        - incrementClickCountToRedis(): separate HINCRBY on a `clicks` hash,
          feeding the denormalized ShortUrl.clicks counter (see below).
   │
   ▼
(scheduled, out-of-band — see docker/crontab)
   │
   ├─ analyticsWorker.js → for every key in `analytics:active`:
   │     - reads the hash, parses dimension counts
   │     - archives that day's HLL sketch (merges live → durable key, see
   │       Unique Visitor Counting below) and reads its cardinality
   │     - upserts one ClickBucket doc keyed on { url_id, date }
   │     - deletes the hash key, removes it from `analytics:active`
   │     - invalidates any cached analytics results for that URL/user
   │
   └─ flushClicksWorker.js → reads the whole `clicks` hash, bulkWrite()'s
        $inc onto ShortUrl.clicks per urlId, clears the hash
```

**Visitor identification** is a hash of `ip:userAgent`, not a cookie or fingerprint — it's a coarse, privacy-conscious proxy for "distinct visitor" (two different people behind the same IP/UA combination collapse into one; the same person on two devices counts as two). This is fed into a HyperLogLog, so exact identity was never the goal — a reasonable unique estimate is.

**Geolocation is currently a stub.** `processClick` hardcodes `country = "IN"` for every click — the `getCountry` lookup (backed by MaxMind GeoIP2, referenced in `shortUrl.controller.js` and `server.js`'s `initGeo`) is commented out in the actual click-processing path. The `countries` breakdown dimension is wired up end-to-end and will populate correctly once real geolocation is re-enabled, but until then every click attributes to the same country.

## Read Path

Each per-URL/overall query follows the same shape:

1. Validate `range` (and `by`, for breakdowns).
2. Check the analytics-specific cache (see below) — return immediately on a hit.
3. On a miss: query `ClickBucket` documents for the date range (`getBucketsByUrl` / `getBucketsByUrls`), merge them (`mergeBuckets`), and — for per-URL summaries only — also read today's still-unflushed data straight from Redis (`getTodayBucketFromRedis`) so "today so far" doesn't wait for the next cron run.
4. Write the result back to cache (fire-and-forget) and return it.

`mergeBuckets` sums `total` and dimension counts across all buckets in range in a single pass. `uniqueVisitors` is **not** summed this way — see [Unique Visitor Counting](#unique-visitor-counting).

**Overall queries don't include today's live Redis data** (unlike per-URL queries) — they're built purely from flushed `ClickBucket` documents. This is a real, current gap: a user's "overall" numbers can lag their individual per-URL numbers by up to one flush interval for same-day activity.

## Caching & Invalidation

Analytics query results are cached with `withCache` (plain read-through, not the stampede-protected variant used by the redirect path — an occasional redundant aggregation under concurrent misses is an acceptable cost here, unlike on the hot redirect route).

| Query type | TTL |
|---|---|
| Summary | 30s |
| Timeseries | 300s |
| Breakdown | 300s |
| Leaderboard | 300s |

Cache keys are scoped per query shape: `cache:analytics:url:{urlId}:{range}:{summary\|timeseries\|breakdown:{dim}}` and `cache:analytics:user:{userId}:{range}:{summary\|timeseries\|breakdown:{dim}\|leaderboard:{limit}}`.

**Invalidation** happens once per flushed bucket, not on every cache read: `invalidateAnalyticsCache(urlId)` runs at the end of each `flushAnalyticsKey` call and `SCAN`s + deletes every `cache:analytics:url:{urlId}:*` key, plus (if the URL has an owner) every `cache:analytics:overall:{userId}:*` key for that owner. It short-circuits (does nothing) if there's no existing 30d summary cache entry for that URL, as a cheap way to skip invalidation work for URLs nobody's actively viewing analytics for.

Because summary TTLs are short (30s) and today's numbers are read live from Redis on the per-URL path regardless, staleness is bounded even between flushes.

## Unique Visitor Counting

Per-day visitor counts use a Redis HyperLogLog (`PFADD`/`PFCOUNT`) rather than a Set, trading a small bounded error rate for O(1) memory regardless of visitor volume.

To get an accurate count across a multi-day range (or across multiple URLs, for "overall" queries), the underlying sketches — not just their per-day cardinality — are preserved and combined:

- At flush time, the day's live sketch (`analytics:{urlId}:{date}:visitors`) is `PFMERGE`d into a durable archive key (`analytics:hll:{urlId}:{date}`, retained for the same 90-day window as the `ClickBucket` doc it feeds), then the live key is cleared. This merge-into-self-plus-source pattern makes it safe to flush the same day more than once (e.g. multiple cron runs before midnight) without losing or double-processing data.
- Range/overall queries collect every relevant archive key (plus today's live key, where applicable) and call `mergeUniqueVisitors`, which `PFMERGE`s them into a scratch key, `PFCOUNT`s it, and deletes the scratch key — giving a true unique count instead of summing per-day/per-URL scalars, which would double-count any visitor who appears in more than one of the merged buckets.

This applies to `getUrlAnalyticsSummary` (across days, one URL), `getOverallAnalyticsSummary` (across days and URLs), and `getOverallAnalyticsTimeseries` (across URLs, per day). `getUrlAnalyticsTimeseries` doesn't need this — each timeseries point covers exactly one bucket already, so its per-day value is exact without merging anything.

## The Separate `ShortUrl.clicks` Counter

`ShortUrl.clicks` is a second, independent click counter, deliberately decoupled from the `ClickBucket` analytics pipeline described above:

- It's fed by its own Redis write buffer (`clicks` hash, `urlId -> count`) and its own cron job (`flushClicksWorker.js`), on a schedule that may differ from the analytics flush.
- It exists purely to make "sort my links by popularity" cheap (an indexed field on `ShortUrl`, `{ user: 1, clicks: -1 }`) without aggregating `ClickBucket` documents on every page load.
- It is **not** kept in lockstep with the analytics numbers — the two pipelines can disagree at any given instant (different flush cadence, different failure modes), and are only expected to eventually converge to the same underlying click count.

## Known Gaps / Accepted Risk

- **Geolocation is a hardcoded stub** (`country = "IN"` for every click) — the real MaxMind-backed lookup exists as a reference (`getCountry`/`initGeo`) but isn't wired into `processClick`. The `countries` breakdown will only be meaningful once that's re-enabled.
- **"Overall" queries don't include today's live data**, only per-URL queries do — a user's aggregate dashboard can undercount today relative to summing their individual links by hand, until the next flush.
- **No durability guarantee between the Redis write buffer and MongoDB.** A click is only durable once the periodic flush writes it into `ClickBucket`/`ShortUrl.clicks`; if the process crashes or Redis loses data (e.g. persistence disabled) between a click landing and the next flush, that window's analytics — and the raw click event that produced it — are gone with no replay mechanism. The BullMQ job itself is discarded on success (`removeOnComplete: { count: 0 }`), so there's no upstream log to replay from either. Mitigations worth considering: verify Redis AOF persistence is actually enabled (`appendfsync everysec` at minimum) rather than relying on RDB snapshots alone; shorten the flush interval to bound the exposure window; and/or retain completed BullMQ click jobs for a rolling window (instead of discarding on `removeOnComplete`) so a mismatch between the aggregate and expected volume can be detected and replayed. None of this is implemented today — it's an accepted trade-off given this is click-count analytics, not transactional data.
- **`ShortUrl.clicks` and `ClickBucket` totals can diverge** at any given moment, since they're two independent pipelines flushed on potentially different schedules — don't treat one as validation for the other.
- **Visitor identity (`sha256(ip:userAgent)`) is a coarse proxy**, not a true unique-user identifier — shared IPs (NAT, corporate networks) undercount distinct people, and the same person across devices/browsers overcounts them. This is a deliberate privacy/simplicity trade-off (no cookies, no fingerprinting), not a bug, but worth knowing when interpreting the numbers.
- **`by` breakdown dimensions are fixed to the six enumerated in `ALLOWED_BREAKDOWNS`** — adding a new dimension (e.g. a `city` field once geolocation is real) requires updating the Redis field-parsing logic in both `saveClickToRedis`/`flushAnalyticsKey`/`getTodayBucketFromRedis` and the `ClickBucket` schema, not just the allowlist.
