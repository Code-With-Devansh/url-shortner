# Database & Data Architecture

This document describes how Snip stores and moves data across MongoDB and Redis: schemas, indexes, caching strategy, and the analytics write/read pipeline. It reflects the code as written, including known caveats.

## Contents

- [Overview](#overview)
- [MongoDB](#mongodb)
  - [`User`](#user)
  - [`ShortUrl`](#shorturl)
  - [`RefreshToken`](#refreshtoken)
  - [`ClickBucket`](#clickbucket)
- [Redis](#redis)
  - [Connections](#connections)
  - [Key Map](#key-map)
  - [Caching Layer (`withCache` / `withStampedeProtection`)](#caching-layer)
  - [Bloom Filter](#bloom-filter)
  - [HyperLogLog (Unique Visitors)](#hyperloglog-unique-visitors)
- [Analytics Data Pipeline](#analytics-data-pipeline)
- [Cursor-Based Pagination](#cursor-based-pagination)
- [Search](#search)
- [Known Gaps / Accepted Risk](#known-gaps--accepted-risk)

---

## Overview

Snip uses a two-tier storage model:

- **MongoDB (Atlas)** is the system of record — users, short URLs, refresh token sessions, and daily-aggregated click analytics.
- **Redis (redis-stack-server)** is the hot-path layer — caching, rate limiting, session lookups, a Bloom filter for existence checks, and a write buffer for click events before they're durably flushed to MongoDB.

The general pattern: writes that need to be fast and cheap (a redirect click, a token refresh check) hit Redis first; a background worker periodically reconciles Redis state into MongoDB.

## MongoDB

### `User`

```
name, email (unique, indexed), password (select: false),
isVerified, verificationToken (select: false), verificationTokenExpires (select: false),
passwordResetToken (select: false), passwordResetTokenExpires (select: false),
avatar (defaults to a Gravatar URL derived from email)
```

- `password` is `select: false` — excluded from query results by default; only the login path explicitly opts in with `.select("+password")`.
- `toJSON()` strips `password` and `__v` unconditionally, so a raw document can never leak a hash through an API response.
- Password hashing (argon2id + pepper) happens in a `pre("save")` hook, only when `password` is modified — so updating any other field on a `User` doesn't re-hash an already-hashed password.
- `email` has a unique index; duplicate registration attempts are caught at the application layer (`registerUser` checks for an existing user first) as well as backstopped by the Mongo unique constraint.

### `ShortUrl`

```
full_url, short_url (unique, indexed), clicks, createdAt,
user (ref: User, optional — null for anonymous links), isActive
```

Indexes:
| Index | Purpose |
|---|---|
| `{ short_url: 1 }` (unique) | Slug lookups — the redirect hot path and slug-collision checks. |
| `{ user: 1, createdAt: -1 }` | A user's URL list sorted by newest first (the common case). |
| `{ user: 1, clicks: -1 }` | A user's URL list sorted by popularity. |
| `{ user: 1, isActive: 1, createdAt: -1 }` | Filtering to only active/inactive links for a user, still sorted by recency. |
| `{ originalUrl: "text", shortCode: "text" }` (named `url_text_search`) | Legacy MongoDB `$text` search — see [Search](#search) caveat below. |

**`clicks` field caveat:** this is a denormalized counter, updated only by the `flushClicksToDB` cron job (via `$inc`) reading from the Redis `clicks` hash — it is *not* updated live on every click, and it is a separate code path from the `ClickBucket` analytics pipeline described below. It exists for cheap "sort my links by popularity" queries without needing to aggregate `ClickBucket` documents. It will lag real click counts by up to one cron interval.

**Ownership:** `user` is nullable specifically to support anonymous link creation; all user-scoped queries (delete, list) filter on `user` explicitly rather than assuming its presence.

### `RefreshToken`

```
user (ref: User, required), token (hashed, indexed),
deviceInfo: { deviceId (indexed, required), ip, userAgent, lastSeen },
expiresAt (TTL index, expires: 0)
```

Indexes:
| Index | Purpose |
|---|---|
| `{ token: 1 }` | Fast lookup during refresh (though Redis is checked first — see below). |
| `{ user: 1, expiresAt: 1 }` | Bulk cleanup / lookups scoped to a user. |
| `{ user: 1, "deviceInfo.deviceId": 1 }` (unique) | One session document per `(user, device)` pair — enforced at the DB level, not just application logic. A login on the same device upserts this document rather than creating a duplicate. |
| `{ expiresAt: 1 }` with `expireAfterSeconds: 0` | **TTL index** — MongoDB automatically deletes expired sessions; there's no manual cleanup job for stale refresh tokens. |

- `token` is hashed (`sha256`) in a `pre("save")` hook before persistence — the raw refresh token is never stored, in Mongo or Redis.
- This collection is the durable fallback for session validation; Redis (`refresh:{userId}:{deviceId}`) is the fast path and is checked first (see [Key Map](#key-map)).

### `ClickBucket`

```
url_id (ref, required), date (String, e.g. "2026-07-01"), total,
uniqueVisitors, countries/devices/browsers/os/referers/hours (each a Map<String, Number>),
expires_at (TTL index)
```

Indexes:
| Index | Purpose |
|---|---|
| `{ url_id: 1, date: -1 }` | Fetching a URL's history, most recent first. |
| `{ expires_at: 1 }` with `expireAfterSeconds: 0` | **TTL index** — buckets self-delete after their configured retention (`RETENTION_DAYS = 90`, set explicitly per-document at flush time rather than as a fixed schema-level TTL, in case retention policy changes later without a migration). |

This is a **pre-aggregated, one-document-per-URL-per-day** schema — a deliberate move away from a naive one-document-per-click model. A single day's traffic for a URL, however large, is one document with counters incremented in it, not N documents. The dimension breakdowns (`countries`, `devices`, etc.) are stored as Mongo `Map` types, which serialize to BSON subdocuments keyed by the dimension value (e.g. `countries: { "IN": 42, "US": 7 }`).

Documents are written by `saveClickBucket` via `findOneAndUpdate` with `upsert: true`, keyed on `{ url_id, date }` — so the flush job is idempotent per `(url, date)` and safe to re-run.

## Redis

### Connections

Two separate Redis client instances are maintained, deliberately:

- `src/config/redis.config.js` — the main `ioredis` client, used for caching, rate limiting, sessions, the Bloom filter, and the click-count write buffer.
- `src/config/bullmq.config.js` — a dedicated `ioredis` connection used only by BullMQ (`clickQueue`, `emailQueue`). BullMQ has specific connection requirements (notably `maxRetriesPerRequest: null`, shared here too) and blocking behavior that's kept isolated from the app's general Redis usage so queue load and cache/session load don't contend on the same connection.

Both clients share the same retry strategy: exponential-ish backoff (`min(times * 100, 3000)` ms) capped at 10 attempts, after which the process logs fatal and exits — a Redis outage that outlasts ~10 retries is treated as unrecoverable for that process rather than silently degrading forever.

### Key Map

| Key pattern | Type | Purpose | TTL |
|---|---|---|---|
| `cache:url:{shortCode}` | String (JSON envelope) | Redirect-path URL cache | 24h fresh / +30s stale grace |
| `lock:cache:url:{shortCode}` | String | `SETNX` lock for stampede protection on the above | 5s |
| `cache:analytics:{scope}:{id}:{range}[:extra]` | String (JSON) | Analytics query result cache (`scope` is `url` or `user`/`overall`) | 30–300s depending on endpoint |
| `ratelimit:{prefix}:{ip}` | Hash (`tokens`, `ts`) | Token-bucket state for the redirect limiter | ~2x refill time |
| (various) via `rate-limit-redis` | — | Fixed-window counters for `express-rate-limit` (login, register, shorten, email, refresh, generic API) | matches each limiter's window |
| `urls:bloom` | RedisBloom `BF` type | Existence pre-check for slugs on the redirect path | none (rebuilt via script if needed) |
| `refresh:{userId}:{deviceId}` | String (hashed token) | Fast-path session validation | 20 days |
| `user_sessions:{userId}` | Set of session keys | Index for bulk session invalidation (logout-everywhere, reuse detection) | 20 days |
| `session:{hashedSessionToken}` | String (userId) | Short-lived token authenticating the email-verification SSE connection | 10 min |
| `claim:{hashedClaimToken}` | String (JSON) | Anonymous-session claim record | 10 min |
| `analytics:{urlId}:{date}` | Hash | Live write buffer for today's click dimensions (`total`, `country:*`, `device:*`, `browser:*`, `os:*`, `referer:*`, `hour:*`) | 48h |
| `analytics:{urlId}:{date}:visitors` | HyperLogLog | Live unique-visitor estimate for today | 48h |
| `analytics:active` | Set | Tracks which `analytics:*` hash keys have pending data, so the flush cron doesn't need to `SCAN` the whole keyspace | — |
| `clicks` | Hash (`urlId -> count`) | Write buffer for the denormalized `ShortUrl.clicks` counter | — (drained and deleted each flush) |

### Caching Layer

Two caching utilities exist, used for different risk profiles:

- **`withCache(key, ttl, fn)`** — a straightforward read-through cache: check Redis, call `fn()` on a miss, write the result back (fire-and-forget, so the caller doesn't wait on the cache write). Used for analytics queries, where an occasional redundant Mongo aggregation under concurrent misses is an acceptable cost.
- **`withStampedeProtection(key, ttl, fn, opts)`** — used only for the redirect path's URL lookup, the single highest-traffic, lowest-latency-budget route in the app. Three layers, cheapest-first:
  1. **In-process single-flight** — concurrent calls for the same key on the same replica share one in-flight promise; no Redis round-trip at all.
  2. **Stale-while-revalidate** — cached values carry their own `freshUntil` timestamp (independent of the Redis key's physical TTL, which is set `freshTtl + 30s` longer). Once stale, callers get the stale value back immediately while exactly one caller refreshes in the background under a lock.
  3. **Redis `SETNX` lock** (`PX` 5000ms) — reached only on a true miss or a stale refresh. Collapses the cross-replica case to one `fn()` call cluster-wide; losers poll every 50ms for up to `lockWaitMs` (150ms on the redirect path) before giving up and just calling `fn()` themselves, favoring correctness over waiting indefinitely if a lock holder crashed.

**Negative caching:** both a real hit and a `null` (URL doesn't exist / inactive) are cached — a `null` result gets its own, shorter TTL (`negativeTtlSeconds`, 60s on the redirect path) rather than the 24h TTL used for real hits, so a slug that starts existing shortly after a failed lookup isn't stuck behind a stale "not found" for a full day.

**Envelope corruption handling:** `readEnvelope` treats any unparseable JSON or unexpected shape as a cache miss rather than throwing — a corrupted or old-format cache entry degrades to "recompute," not a 500.

### Bloom Filter

`urls:bloom` (RedisBloom, `BF.RESERVE` with 1% error rate, 1M capacity) is checked before any real lookup on the redirect path. Every newly created slug is added via `BF.ADD` immediately after the Mongo write, and via a Bloom insert on the optimistic-create path as well. This turns the very common case of "request for a slug that never existed" (typos, scanners, bots probing random paths) into a cheap Redis check instead of a Mongo/cache round-trip. False positives are expected and harmless (they just fall through to the real lookup, which correctly returns not-found); false negatives are not possible for slugs that were actually added. A rebuild script (`src/scripts/rebuildBloom.js`) exists to repopulate the filter from MongoDB if it's ever lost or needs resizing.

### HyperLogLog (Unique Visitors)

Unique visitor counts use Redis HyperLogLog (`PFADD`/`PFCOUNT`), keyed per `(urlId, date)`, seeded with `sha256(ip:userAgent)` as the "visitor" identifier. HLL trades a small, bounded error rate for O(1) memory regardless of visitor count — appropriate here since exact uniqueness isn't the goal, a good estimate is.

Each `ClickBucket` document still stores a per-day `uniqueVisitors` scalar (cheap, useful for single-day views), but the underlying HLL sketch is no longer discarded after that scalar is extracted. At flush time, `archiveHllForDate` merges the live daily sketch (`analytics:{urlId}:{date}:visitors`, 48h TTL) into a durable archive key (`analytics:hll:{urlId}:{date}`, retained for `RETENTION_DAYS`) via `PFMERGE`, then clears the live key. Range queries (`getUrlAnalyticsSummary`, `getOverallAnalyticsSummary`, `getOverallAnalyticsTimeseries`) compute their `uniqueVisitors` figure by collecting the relevant archive (and, for "today," live) HLL keys and calling `mergeUniqueVisitors`, which `PFMERGE`s them into a scratch key and `PFCOUNT`s the result — a true cross-day (and cross-URL, for the "overall" endpoints) unique count, not a sum of per-day scalars. The scratch key is deleted immediately after counting.

## Analytics Data Pipeline

```
click on GET /:shortId
   │
   ├─ recordClick() enqueues a BullMQ job on the "clicks" queue (fire-and-forget from the visitor's perspective)
   │
   ▼
clickWorker.js (BullMQ worker, concurrency 10)
   │
   ├─ processClick(): parses user-agent, hashes visitor (ip+ua), extracts date/hour
   │
   ├─ saveClickToRedis(): one Redis MULTI pipeline —
   │     HINCRBY analytics:{urlId}:{date}         total, country:*, device:*, browser:*, os:*, referer:*, hour:*
   │     PFADD  analytics:{urlId}:{date}:visitors visitorHash
   │     SADD   analytics:active                  analytics:{urlId}:{date}   (so the flush job knows this key exists)
   │     EXPIRE (NX, 48h) on both the hash and the HLL key
   │
   └─ incrementClickCountToRedis(): HINCRBY clicks {urlId} 1   (separate write buffer, feeds ShortUrl.clicks)
   │
   ▼
(periodic cron jobs — outside the request path entirely)
   │
   ├─ analyticsWorker.js → flushAnalyticsKey() per key in `analytics:active`:
   │     reads the hash + PFCOUNT's the HLL, writes one ClickBucket doc (upsert on {url_id, date}),
   │     deletes both Redis keys, invalidates any cached analytics results for that URL/user,
   │     removes the key from `analytics:active`
   │
   └─ flushClicksWorker.js → flushClicksToDB():
         reads the whole `clicks` hash, bulkWrite()'s $inc on ShortUrl.clicks per urlId, clears the hash
```

Both cron jobs are standalone scripts (run via `npm run cron:*`, intended to be scheduled externally — see `docker/crontab`), not long-running processes, and both explicitly connect to Mongo/Redis, do their work, and exit — appropriate for a periodic batch job rather than a service.

**Read side:** analytics queries (`getUrlAnalyticsSummary`, etc.) merge **flushed MongoDB buckets** for past days with a **live read straight from the Redis hash** for today (`getTodayBucketFromRedis`), so "today so far" is never a day behind waiting for the next cron run. This merge happens in `mergeBuckets()`, which is also where the multi-day `uniqueVisitors` sum (and its upper-bound caveat above) originates.

## Cursor-Based Pagination

The user URL list (`getUserUrls`) uses keyset (cursor) pagination rather than `skip`/`limit`, to stay performant on deep pages:

- The cursor encodes `{ id, value }` — `id` is the last-seen document's `_id` (used as a tiebreaker), `value` is the last-seen value of whatever field is being sorted on.
- The Mongo filter for the next page is `{ [sortBy]: { $gt/$lt: value } } OR { [sortBy]: value, _id: { $gt/$lt: id } }` — the tiebreaker clause handles ties in the sort field correctly (e.g. two URLs created in the same millisecond).
- `createdAt`-sorted pages skip the `$or` entirely and just compare `_id` (which is itself time-ordered in MongoDB), since `_id` alone is already a strict superset of that ordering.
- One extra document is always fetched (`limit + 1`) to cheaply determine `hasMore` without a separate `count()` query.

## Search

Two search paths exist, selected via `USE_ATLAS_SEARCH`:

- **Legacy MongoDB `$text` search** (`{ originalUrl: "text", shortCode: "text" }` index) — kept for local/non-Atlas environments, but has a known limitation: MongoDB's `$text` operator matches whole tokens, not substrings, so a search for `"git"` will not match a stored URL containing `"github.com"`. It's functional for exact-word searches only.
- **Atlas Search** (`$search` aggregation stage, `search_index`, `autocomplete` with `nGram` tokenization on `full_url` and `short_url`) — the production path, and the one that actually supports substring/fuzzy matching the way users expect from a search box. `short_url` matches are boosted (`score: { boost: { value: 2 } }`) since an exact or near-exact slug match is a stronger signal of intent than a substring hit inside a long destination URL.

`prepareSearchQuery` strips the app's own domain (`BASE_URL`) from the front of a pasted query before searching — so pasting the full short link back into the search box (`https://snp.2bd.net/abc123`) searches for `abc123`, not the whole URL including a domain that would never match anything in `full_url`.

## Known Gaps / Accepted Risk

- **`ShortUrl.clicks` and the `ClickBucket` analytics pipeline are two independent write paths** off the same click event, reconciled by two separate cron jobs on (potentially) different schedules — they are not guaranteed to agree at any given instant, only to both eventually converge.
- **No transactional guarantee between the Redis write buffer and MongoDB.** If a process crashes between `HINCRBY` and the next flush, in-memory Redis data survives (Redis is configured with its own persistence), but there's no two-phase commit — a Redis data-loss event (e.g. a misconfigured instance with persistence disabled) between click and flush would lose that window's analytics with no replay mechanism.
- **The legacy `$text` search index is present but only substring-capable via Atlas Search**, not via `$text` itself — worth knowing if `USE_ATLAS_SEARCH` is ever run in an environment without an Atlas Search index configured.
- **No documented backup/restore or point-in-time-recovery process** for MongoDB Atlas in this repo — if Atlas's built-in continuous backups are relied on, that should be stated explicitly here rather than assumed.
