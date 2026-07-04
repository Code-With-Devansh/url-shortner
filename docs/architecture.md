# Architecture

Snip is a URL shortener built around one constraint: the redirect path (`GET /:shortId`) is the highest-traffic, most latency-sensitive route in the system, and every other piece of the architecture exists either to keep that path fast or to process the side effects it generates without slowing it down.

This doc covers the system end-to-end at a high level. For deep dives, see [`database.md`](./database.md), [`authentication.md`](./authentication.md), [`analytics.md`](./analytics.md), [`security.md`](./security.md), and [`deployment.md`](./deployment.md).

## Goals that shaped the design

- **The redirect must stay fast under load**, including bursty/viral traffic on a single link. No request on that path should block on a synchronous database write.
- **Click data shouldn't cost a database write per click.** Clicks are aggregated, not written one row at a time.
- **Auth should support multiple devices per user** without one device's logout or token rotation invalidating another's session.
- **The system runs as multiple stateless API replicas** behind a reverse proxy, so anything "in memory" (rate limit counters, SSE connections, etc.) has to either be replica-local by design or coordinated through Redis.

## System diagram

```
                            ┌─────────────┐
                            │   Vercel    │
                            │  (frontend) │
                            └──────┬──────┘
                                   │ HTTPS (CORS, credentials: true)
                                   ▼
                            ┌─────────────┐
                            │    nginx    │  (EC2 VPS)
                            └──────┬──────┘
                  ┌────────────────┼────────────────┐
                  ▼                                  ▼
           ┌─────────────┐                   ┌─────────────┐
           │  server     │                   │  server2    │   (N stateless replicas)
           │ (Express)   │◄─── Redis Pub/Sub ►│ (Express)   │   (SSE fan-out)
           └──────┬──────┘                   └──────┬──────┘
                  │                                  │
       ┌──────────┼──────────────────────────────────┼──────────┐
       ▼          ▼                                  ▼          ▼
  ┌─────────┐ ┌──────────┐                     ┌──────────┐ ┌─────────┐
  │ MongoDB │ │  Redis   │◄──── BullMQ jobs ───►│  worker- │ │ worker- │
  │  Atlas  │ │  Stack   │                      │  click   │ │  email  │
  └─────────┘ └──────────┘                     └──────────┘ └─────────┘
                  ▲
                  │ per-minute flush + 5-min recovery sweep
                  │
            ┌─────────────┐
            │  cron        │  (analyticsWorker, analyticsRecoveryWorker)
            └─────────────┘
```

## Components

### Express API (`server`, `server2`)

A single Express app (`app.js`) handling four route groups: short URL creation/deletion, the redirect itself, auth, and analytics. It's deployed as **two replicas** behind nginx, which is the reason a few things below are built the way they are (Redis-backed rate limiting and pub/sub instead of in-process state).

Per-request middleware order matters here:

```
CORS → request logger → global concurrency limiter → helmet → body parsers
  → cookie parser → static (/static) → shutdown gate → routes → error handler
```

Two load-shedding layers run before any route handler:

- **`tokenBucketLimiter`** on the redirect route specifically — a Lua-scripted token bucket per IP in Redis, sized to tolerate a single link going viral (bursty traffic from one popular link) without punishing it the way a fixed window would.
- **`concurrencyLimiter`** globally — an in-process counter (deliberately *not* Redis-backed) that sheds load once too many requests are in flight on *this* replica. It protects this process's event loop and connection pools; since each replica gets its own ceiling, the limit scales naturally with however many replicas are running.

See [`security.md`](./security.md) for the full rate-limiting matrix (login, register, shorten, refresh, email).

### Redirect hot path

`GET /:shortId` is optimized harder than anything else in the app:

1. **Bloom filter check** (`BF.EXISTS` on `urls:bloom`, a Redis Stack command) — a fast, low-memory existence check that lets nonexistent slugs 404 in well under a millisecond without ever touching Mongo. Fails open on Redis errors, since a probabilistic pre-filter going down should degrade to "skip the optimization," not "take down redirects."
2. **Cache-aside lookup** (`withCache`) — on a bloom hit, the URL doc is read from a Redis string cache (`cache:url:<shortId>`, 24h TTL) before falling back to MongoDB. A miss populates the cache for next time.
3. **Validation** — the cached/fetched target is checked against an allow-list of `http(s)` protocols before anything redirects there.
4. **Click recorded asynchronously** — a `clicks` BullMQ job is enqueued with the click metadata and the handler returns immediately; nothing about analytics blocks the response.
5. **Interstitial page returned** —  rather than a 302, the server returns a small static HTML/CSS/JS page (buildRedirectPage) that shows the visitor exactly where they're about to be sent, counts down, and lets them cancel if the destination looks wrong or untrustworthy before it navigates. This is a safety/transparency UX decision, not a mechanism for recording the click — the click is already queued server-side by the time this page is sent.

Because the bloom filter is probabilistic (it can false-positive but never false-negative), the real authority on existence is still MongoDB — the bloom filter only short-circuits the *negative* case cheaply. `src/scripts/rebuildBloom.js` exists to repopulate the filter from MongoDB from scratch if it's ever lost (e.g. Redis data loss) or needs rebuilding.

### Background jobs (BullMQ)

Two queues, two dedicated worker processes — deliberately split so a slow email provider can never back up click processing, or vice versa:

| Queue | Worker | Concurrency | Job |
|---|---|---|---|
| `clicks` | `clickWorker.js` | 10 | Parse UA, geo, build a visitor hash, write aggregated counters into Redis (see [`analytics.md`](./analytics.md)) |
| `emails` | `emailWorker.js` | 5 (rate-limited to 10/sec) | Send verification / password-reset email via Resend |

Both queues use BullMQ's `removeOnComplete`/`removeOnFail` policies to keep Redis from accumulating finished job data indefinitely. Workers run as separate processes/containers (`worker-click`, `worker-email` in `docker-compose.yml`), not inside the API process — so a worker crash or redeploy never takes the API down, and either side can be scaled independently.

### Analytics pipeline

Clicks never write to MongoDB directly. They land in Redis (per-URL, per-day hash counters + a HyperLogLog for approximate unique visitors), and a cron job periodically flushes that buffer into a pre-aggregated `ClickBucket` collection in MongoDB. This trades a small amount of latency on *reading* analytics (today's numbers are blended live from Redis + historical buckets from Mongo) for removing a database write from every single click. Full details, including the known caveats around the unique-visitor figure, are in [`analytics.md`](./analytics.md).

### Auth

Dual-token JWT auth (short-lived access token, longer-lived refresh token in an `httpOnly` cookie) with multi-device support via a per-device `deviceId` cookie. Refresh tokens are cached in Redis as a fast-path lookup in front of MongoDB, with reuse detection that nukes every session for a user if a rotated-out token is ever presented again. Full flow, including the SSE-based "waiting for email verification" pattern, is in [`authentication.md`](./authentication.md).

### Caching layer

A single Redis Stack instance does multiple jobs at once, each with its own key namespace:

- **URL cache** — `cache:url:<shortId>`, used by the redirect path.
- **Analytics cache** — `cache:analytics:<scope>:<id>:<range>:<view>`, fronting the analytics read endpoints with short TTLs (30s–5min depending on endpoint), invalidated on flush.
- **Session cache** — `refresh:<userId>:<deviceId>`, a fast-path mirror of the MongoDB `RefreshToken` collection.
- **Bloom filter** — `urls:bloom`, the redirect existence check.
- **Rate limit counters** — `ratelimit:*` (token bucket) and the `rate-limit-redis` store used by `express-rate-limit`.
- **Click write-buffer** — `analytics:<urlId>:<date>:<HH:MM>` per-minute hashes + `:visitors` HLLs, plus an `analytics:active` set (and, once claimed for flushing, a `processing:*` key + `processing:active` set) tracking which buckets currently have unflushed data.
- **SSE pub/sub channel** — `sse:notify`, used to fan out email-verification events across replicas (see below).

Redis Stack specifically (not vanilla Redis) is required here because of the Bloom filter (`BF.*`) and HyperLogLog (`PF*`) commands used on the redirect hot path and in analytics.

### Cross-replica SSE

The email-verification flow holds open an SSE connection (`GET /api/auth/verify-status`) so the frontend can react the instant a user clicks the verification link in another tab/device — but with two stateless API replicas behind nginx, the connection holding that request and the request that completes verification can land on *different* replicas. Each replica keeps an in-memory `Map` of `userId → response stream` for connections it's holding, and a Redis Pub/Sub channel (`sse:notify`) broadcasts verification events to all replicas; whichever replica is actually holding that user's connection writes the SSE event to it. Replicas that aren't holding that connection just no-op on the message — expected, not an error.

### Data layer

- **MongoDB Atlas** — the source of truth for users, short URLs, refresh tokens, and aggregated click buckets.
- **Redis Stack** — cache, queues (via BullMQ), rate limiting, bloom filter, and the click write-buffer described above.

Schema details, indexes, and Redis key reference live in [`database.md`](./database.md).

### Deployment shape

- API replicas, both workers, and the cron container are all built from variants of the same image (`Dockerfile` / `Dockerfile.cron`) and run via Docker Compose, fronted by nginx on a single EC2 VPS.
- The cron container runs Alpine's built-in `crond`, scheduling the per-minute analytics flush (`analyticsWorker.js`, which also updates `ShortUrl.clicks` in the same transaction) and a 5-minute crash-recovery sweep (`analyticsRecoveryWorker.js`) as separate Node invocations rather than long-running processes.
- The frontend is a separately deployed React/Vite app on Vercel, talking to the API cross-origin (hence `credentials: true` CORS and `sameSite: "none"` cookies in production).

Full deployment topology, environment variables, and nginx config are in [`deployment.md`](./deployment.md).

## Request flow: creating a short URL

```
POST /api/create
  → attachUser            (optional: attaches req.user if a valid access token is present)
  → rate limiter          (tighter cap for anonymous, looser for authenticated)
  → validate full_url (and slug, if provided) with Zod
  → generate id (nanoid, 7 chars) or use custom slug
  → check slug uniqueness (authenticated custom slugs only)
  → save ShortUrl doc in MongoDB
  → cache the new URL                 (cache:url:<id>)
  → add the new slug to the bloom filter
  → return { short_id, short_url, full_url }
```

## Request flow: a click

```
GET /:shortId
  → token bucket rate limit (per IP)
  → bloom filter check            → 404 early if definitely absent
  → cache-aside lookup             → MongoDB on cache miss
  → validate target is http(s)
  → enqueue a "clicks" BullMQ job  (fire-and-forget, doesn't block the response)
  → return interstitial redirect page

   ...asynchronously, in worker-click...

  → parse user agent, hash (ip, ua) into a visitor hash, resolve country
  → HINCRBY counters + PFADD visitor hash into this minute's Redis bucket
  → mark this minute's bucket key as "active" (for the flush cron to find)

   ...every minute, in the cron container...

  → for each due active bucket (past its minute + grace period): atomically
    claim it (Redis RENAME), read it, and in one MongoDB transaction upsert
    it into a ClickBucket document AND $inc ShortUrl.clicks, then delete the
    claimed key and invalidate cached analytics responses for that URL/owner
  → a claim left unresolved for 5+ minutes (crashed flush) is picked back up
    and re-flushed by a separate recovery sweep, so a crash mid-flush can't
    silently drop that minute's clicks
```

## Where to go next

- New to the auth flow? Start with [`authentication.md`](./authentication.md).
- Debugging analytics numbers? [`analytics.md`](./analytics.md) covers the Redis→Mongo pipeline and its known limitations.
- Looking for a specific endpoint? [`api.md`](./api.md).
- Setting up or modifying infrastructure? [`deployment.md`](./deployment.md).
- Rate limits, CORS, CSRF posture, token handling? [`security.md`](./security.md).
- Collections, indexes, Redis key reference? [`database.md`](./database.md).
