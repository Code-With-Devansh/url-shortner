# Analytics

This document describes Snip's click-analytics system end to end: the API surface, the write pipeline from click to durable storage, the caching strategy, and known limitations.

## Contents

- [Overview](#overview)
- [API Endpoints](#api-endpoints)
- [Query Parameters](#query-parameters)
- [Write Pipeline](#write-pipeline)
- [Minute-Bucketed Buffering](#minute-bucketed-buffering)
- [Read Path](#read-path)
- [Per-User Live Aggregates](#per-user-live-aggregates)
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
        - Extracts date (YYYY-MM-DD), hour (00–23), and a minute bucket
          (HH:MM, UTC) from the click's own timestamp — not from "now" when
          the worker happens to process it, so a delayed job still lands in
          the bucket it actually occurred in.
        - saveClickToRedis(): one Redis MULTI pipeline, atomic, all keyed
          per-minute (analytics:{urlId}:{date}:{HH:MM}) rather than
          per-day — see "Minute-Bucketed Buffering" below for why —
            HINCRBY analytics:{urlId}:{date}:{HH:MM}   total, country:*, device:*,
                                                          browser:*, os:*, referer:*, hour:*
            PFADD   analytics:{urlId}:{date}:{HH:MM}:visitors   visitorHash
            EXPIRE  (NX) both keys → 48h (safety net only — see below)
            SADD    analytics:active   analytics:{urlId}:{date}:{HH:MM}
   │
   ▼
(scheduled every minute — see docker/crontab)
   │
   └─ analyticsWorker.js → for every key in `analytics:active`:
         - flushAnalyticsKey(key) skips the key entirely (leaves it in the
           set, untouched) if its minute hasn't fully elapsed plus a grace
           period yet — i.e. it's the current, still-being-written minute.
         - for keys that are due: claimKey() runs a single Lua script that
           atomically RENAMEs analytics:{...} → processing:{...} and moves
           the key from the `analytics:active` set to the `processing:active`
           sorted set (scored by claim time). The RENAME is the crash-safety
           mechanism — the bucket's data exists under exactly one key at
           every point in time, so a process dying mid-flush can't lose it
           or double-process it; it's just left claimed for recovery.
         - flushClaimedKey(processingKey): reads the claimed hash, PFMERGEs
           that minute's HLL sketch into the day's durable archive key
           (accumulates across every minute of the day), reads the
           day-so-far cardinality from it, then in ONE MongoDB transaction:
             - upserts (via $inc, not $set) that minute's fragment onto the
               day's ClickBucket doc, keyed on { url_id, date }
             - $inc's ShortUrl.clicks by that minute's total — same
               transaction, same numbers, so it can't drift from ClickBucket
         - on success: deletes the processing:* key, removes it from
           processing:active, invalidates cached analytics results for that
           URL/owner
         - on failure (the transaction throws): the processing:* key and
           its processing:active entry are deliberately left in place —
           nothing is deleted, it just stays "claimed" until recovered

(scheduled every 5 minutes, offset 2 min — see docker/crontab)
   │
   └─ analyticsRecoveryWorker.js → sweeps `processing:active` for any claim
         older than a 5-minute stale threshold (a normal flush finishes in
         well under that, so age past it means the claiming process likely
         crashed or was killed mid-flush) and calls flushClaimedKey() again
         for each one — this is the replay mechanism: a crash between claim
         and commit doesn't lose click data, it just waits under a
         processing:* key until this sweep picks it back up.
```

**Visitor identification** is a hash of `ip:userAgent`, not a cookie or fingerprint — it's a coarse, privacy-conscious proxy for "distinct visitor" (two different people behind the same IP/UA combination collapse into one; the same person on two devices counts as two). This is fed into a HyperLogLog, so exact identity was never the goal — a reasonable unique estimate is.

**Geolocation is currently a stub.** `processClick` hardcodes `country = "IN"` for every click. The `countries` breakdown dimension is wired up end-to-end and will populate correctly once real geolocation is re-enabled, but until then every click attributes to the same country.

## Minute-Bucketed Buffering

The Redis write buffer is bucketed **per minute** (`analytics:{urlId}:{date}:{HH:MM}`), not one mutable key per day. This is what makes flushing every minute (the current `docker/crontab` schedule — see [`DEPLOYMENT.md`](./DEPLOYMENT.md#scheduled-jobs)) safe:

- A minute bucket only ever receives writes during its own 60-second window (plus a small grace period, see below). Once that window has fully passed, no worker will ever write to that key again — so the flush job can read-then-delete it without a lock, with no risk of racing a concurrent `HINCRBY`.
- A single always-open per-day key, by contrast, has no such guarantee: a flush job reading and then deleting it can race a click landing in the same instant, silently losing that increment. That race gets proportionally more likely to actually bite the more frequently you flush — which is exactly the failure mode a tighter flush schedule would otherwise introduce.
- `isBucketDueForFlush(date, minute)` gates this: a bucket becomes eligible only once its 60s window has ended **and** an additional 60s grace period has passed on top, to absorb ordinary BullMQ processing lag — a click that happened at `14:36:59` might not be processed by the worker (and land in the `14:36` bucket) until a few seconds into `14:37`. `flushAnalyticsKey` simply returns early (no-op, leaving the key untouched in `analytics:active`) for any bucket that isn't due yet; it gets picked up on a later cron run once it is.
- Each minute's HLL sketch is merged (`PFMERGE`) into the day's durable archive key (`analytics:hll:{urlId}:{date}`) at flush time, the same mechanism described in [Unique Visitor Counting](#unique-visitor-counting) — this is what lets the archive accumulate correctly across many small per-minute flushes instead of just one big flush at day's end.
- `ClickBucket.total` (and the dimension maps) are written via **`$inc`**, not `$set` (see `saveClickBucket` in `src/dao/clickBucket.dao.js`). This matters specifically because of the frequent flush schedule: each flush only ever carries one minute's fragment of the day's clicks, so an overwrite (`$set`) would clobber every earlier flush for that date instead of accumulating on top of it. `uniqueVisitors` is the one field that stays `$set` — it's read fresh from the day's HLL archive on every flush, which already reflects the whole day's cardinality so far, not just the latest fragment.

## Read Path

Each per-URL/overall query follows the same shape:

1. Validate `range` (and `by`, for breakdowns).
2. Check the analytics-specific cache (see below) — return immediately on a hit.
3. On a miss: query `ClickBucket` documents for the date range (`getBucketsByUrl` / `getBucketsByUser`) — this **includes today**, since today's document is now updated incrementally by every minute's flush rather than written once at the end of the day — merge them (`mergeBuckets`), and additionally read whatever's still sitting unflushed in Redis for today and merge that in on top.
4. Write the result back to cache (fire-and-forget) and return it.

`mergeBuckets` sums `total` and dimension counts across all buckets in range in a single pass. `uniqueVisitors` is **not** summed this way — see [Unique Visitor Counting](#unique-visitor-counting).

**Per-URL reads** (`getUrlAnalyticsSummary`) still get "today's remainder" via `getLiveBucketForToday(urlId)`, which reads that URL's own active minute-bucket keys directly (`getActiveBucketKeysForDate`) — this was always O(that URL's activity today), never O(account size), so it didn't need to change.

**Overall (account-wide) reads no longer resolve a user's URL list from MongoDB at all.** Previously, `getOverallAnalyticsSummary` / `getOverallAnalyticsTimeseries` / `getOverallAnalyticsBreakdown` / `getOverallAnalyticsLeaderboard` all called a `getUserUrlIds(userId)` DAO function (`ShortUrl.find({ user: userId }, "_id")`) up front, then used that id list to fan out over per-URL Redis structures — a query and a fan-out that both scaled with the user's *total* URL count, not their activity. An account with hundreds of thousands of URLs paid that cost on every overall-analytics request regardless of how many of those URLs had ever been clicked. That function has been removed; each overall endpoint now gets what it needs directly from **per-user live Redis structures**, maintained incrementally by every click and decremented at flush time — see [Per-User Live Aggregates](#per-user-live-aggregates) below.

## Per-User Live Aggregates

In addition to the per-minute per-URL buckets, every click belonging to an authenticated user's URL (anonymous/unowned URLs skip this — `user` is optional on `ShortUrl`) also updates two per-user Redis structures, in the same `MULTI` pipeline as the minute bucket:

| Key | Type | Purpose |
|---|---|---|
| `analytics:live:total:{userId}` | String (counter) | Running count of this user's unflushed clicks across all URLs today. `INCR`'d on every click, `DECRBY`'d at flush. |
| `analytics:live:{userId}` | Sorted set, member = `urlId`, score = unflushed clicks | Per-URL live click counts for this user — powers the leaderboard, and doubles as an index of "which URLs are active today." `ZINCRBY`'d on every click, `ZINCRBY`'d negatively at flush; a member whose score reaches 0 is `ZREM`'d. |

At flush time (`decrementLiveCounters` in `src/cache/clickBucket.redis.js`, called from `flushClaimedKey` right after the Mongo transaction commits), the exact number of clicks just persisted is subtracted from both structures for that URL's owner. This keeps both structures containing *only* unflushed clicks at all times — a URL with no activity today (or whose today's activity has all been flushed) simply isn't a member of the ZSET, and the total counter reflects only what Mongo doesn't have yet.

This subtraction is plain Redis commands, not a Lua script — safe because by the time `flushClaimedKey` runs, the bucket in question was already claimed exclusively via the atomic `RENAME` (`analyticsClaim.lua`), so no other writer can still be incrementing the numbers being subtracted. There's nothing left to race against.

**What each overall endpoint does with this:**

- **`getOverallAnalyticsSummary` / `getOverallAnalyticsTimeseries`** — today's live *total* is a single `GET analytics:live:total:{userId}`, O(1) regardless of account size. Unique-visitor merging still needs actual HLL keys (a scalar counter can't be `PFMERGE`d), so those are looked up by reading the live ZSET's *members* (`ZRANGE analytics:live:{userId} 0 -1`) — the set of URLs with unflushed clicks today — and deriving each one's active minute-bucket keys from there. This fan-out is bounded by **today's active URL count**, not total URLs owned.
- **`getOverallAnalyticsLeaderboard`** — reads `ZREVRANGE analytics:live:{userId} 0 {limit-1} WITHSCORES` directly for the live side of the merge, replacing what used to be a per-URL fan-out over the full owned-URL list. Merged with Mongo's own top-K and re-sorted, both sides bounded by the requested (capped) `limit` — so the merge itself is bounded by roughly `2 × limit` candidates regardless of account size.
- **`getOverallAnalyticsBreakdown`** — the one overall endpoint that still does a genuine per-URL Redis fan-out, because per-dimension counts (country/browser/device/OS/referrer) aren't tracked in a live per-user aggregate — only the scalar total and the per-URL click count are. Adding live per-dimension hashes was considered and deliberately rejected (see [`Design-decisions.md`](./Design-decisions.md)): it would add several extra Redis writes to every single click to speed up an endpoint that's hit far less often than summary/timeseries/leaderboard. So breakdown still calls `getActiveBucketKeysForUrls`, but the candidate URL list now comes from the live ZSET's members instead of Mongo — bounded by today's active URLs, same as the summary/timeseries HLL lookup above, not by the account's total URL count.



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

- At flush time, each due minute bucket's sketch (`analytics:{urlId}:{date}:{HH:MM}:visitors`) is `PFMERGE`d into a durable, per-day archive key (`analytics:hll:{urlId}:{date}`, retained for the same 90-day window as the `ClickBucket` doc it feeds), then that minute's key is cleared. This merge-into-self-plus-source pattern makes it safe to flush many minutes over the course of a day without losing or double-processing data.
- Range/overall queries collect every relevant archive key (plus whatever live minute-bucket HLL keys are still unflushed for today, where applicable) and call `mergeUniqueVisitors`, which `PFMERGE`s them into a scratch key, `PFCOUNT`s it, and deletes the scratch key — giving a true unique count instead of summing per-day/per-URL scalars, which would double-count any visitor who appears in more than one of the merged buckets.

This applies to `getUrlAnalyticsSummary` (across days, one URL), `getOverallAnalyticsSummary` (across days and URLs), and `getOverallAnalyticsTimeseries` (across URLs, per day). `getUrlAnalyticsTimeseries` doesn't need this — each timeseries point covers exactly one Mongo bucket already, and (per the [Read Path](#read-path) note above) doesn't merge in live data, so its per-day value is exact as of the last flush without merging anything at query time.

## The Separate `ShortUrl.clicks` Counter

`ShortUrl.clicks` is a second, denormalized click counter — kept for cheap "sort my links by popularity" queries (an indexed field, `{ user: 1, clicks: -1 }`) without aggregating `ClickBucket` documents on every page load. It **used to** be fed by its own independent Redis write buffer and cron job on a possibly-different schedule, which meant it could disagree with the `ClickBucket` analytics numbers at any given instant.

**That's been fixed.** The separate `clicks` Redis hash and `flushClicksWorker.js` are gone. `ShortUrl.clicks` is now `$inc`'d inside the exact same MongoDB transaction, from the exact same aggregated numbers, as the `ClickBucket` write for that flush (`flushClaimedKey` in `src/cron/jobs/flushClaimedKey.js`) — one write path, not two. It's still not updated live on every click (same ~1–2 minute flush-interval lag as everything else on this pipeline), but it can no longer drift out of sync with `ClickBucket` the way an independently-scheduled counter could.

## Known Gaps / Accepted Risk

- **"Top URL" in the overall summary is still Mongo-only** (`getCachedTopUrls`) — it ranks by `ClickBucket.total`, which doesn't include today's still-unflushed remainder, so a URL that just went viral in the last minute won't show up as `topUrl` until the next flush. **The leaderboard no longer has this gap** — `getOverallAnalyticsLeaderboard` merges Mongo's historical top-K with a live read of `analytics:live:{userId}` (see [Per-User Live Aggregates](#per-user-live-aggregates)), so today's still-unflushed clicks are reflected in the ranking immediately, not just after the next flush.

- **Visitor identity (`sha256(ip:userAgent)`) is a coarse proxy**, not a true unique-user identifier — shared IPs (NAT, corporate networks) undercount distinct people, and the same person across devices/browsers overcounts them. This is a deliberate privacy/simplicity trade-off (no cookies, no fingerprinting), not a bug, but worth knowing when interpreting the numbers.
- **`by` breakdown dimensions are fixed to the six enumerated in `ALLOWED_BREAKDOWNS`** — adding a new dimension (e.g. a `city` field once geolocation is real) requires updating the Redis field-parsing logic in both `saveClickToRedis`/`flushAnalyticsKey`/`aggregateBucketKeys` and the `ClickBucket` schema, not just the allowlist.
- **Per-user live aggregates add 2 extra Redis writes to every click** (on top of the existing minute-bucket write) for URLs that have an owner — an `INCR` and a `ZINCRBY`, both in the same pipeline as the minute-bucket update, so no extra round-trip, just extra commands per pipeline. Live per-dimension breakdown hashes (country/browser/device/OS/referrer) were deliberately *not* added on top of this, specifically to keep this number small — see [Per-User Live Aggregates](#per-user-live-aggregates) and [`Design-decisions.md`](./Design-decisions.md). If click-ingestion throughput ever becomes the bottleneck rather than analytics-read latency, this is the tax to revisit first.
