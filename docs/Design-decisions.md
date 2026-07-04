# Design Decisions

This document captures the *why* behind Snip's architecture — the deliberate choices, not just what the system does. For what the system does, see [`architecture.md`](./architecture.md), [`database.md`](./database.md), [`authentication.md`](./authentication.md), [`analytics.md`](./ANALYTICS.md), and [`deployment.md`](./DEPLOYMENT.md).

## The redirect path is the design center

Almost every other decision in this system traces back to one constraint: `GET /:shortId` is the highest-traffic, most latency-sensitive route, and it must never block on a synchronous database write. That single constraint explains:

- Why clicks are queued (BullMQ), not written inline.
- Why there's a Bloom filter in front of Mongo.
- Why the URL cache uses stampede protection while the analytics cache doesn't.
- Why analytics is a Redis write-buffer + periodic flush instead of "just write to Mongo."

Everything downstream of the redirect (analytics, click counting) was deliberately allowed to be *eventually* consistent so the thing visitors actually wait on could stay fast and simple.

## Bloom filter before Mongo

`urls:bloom` (RedisBloom, 1% error rate) exists purely to make the "slug doesn't exist" case — typos, bots, scanners — cheap. It's probabilistic and can false-positive, so Mongo remains the actual source of truth; the filter only ever short-circuits the negative case. This was a deliberate choice to accept a small amount of Redis memory and a rebuild script (`rebuildBloom.js`) in exchange for keeping garbage traffic off the database entirely, rather than trying to make the false-positive rate zero (which would cost far more memory for diminishing returns).

## Cache-aside + stampede protection, but only on the hot path

`withCache` (plain read-through) is used for analytics, where a redundant aggregation under concurrent misses is cheap and rare. `withStampedeProtection` (in-process single-flight → stale-while-revalidate → Redis `SETNX` lock) is reserved for the redirect path specifically, because that's the one place where a cold cache under viral traffic could otherwise send a stampede of identical queries at Mongo simultaneously. This is a case of *not* applying the fanciest tool everywhere — the extra complexity of three-layered stampede protection is only worth it where the traffic pattern (many concurrent requests for one popular, possibly-newly-cached key) actually produces a stampede.

## Interstitial redirect page instead of a 302

Rather than an instant 302, the redirect route returns a small static page that shows the destination, counts down, and lets the visitor cancel. This is a transparency/safety decision (a URL shortener is an easy phishing vector — showing the destination before navigating gives a visitor a chance to bail), not a mechanism for capturing the click. The click is already enqueued server-side before this page is ever sent, so the interstitial doesn't affect analytics accuracy or latency budget.

## Two-token JWT auth, keyed per device rather than per user

Access tokens are short-lived (15 min) and live in memory/header, never a cookie. Refresh tokens are longer-lived (20 days), `httpOnly`, and scoped to `(userId, deviceId)` rather than just `userId`. The deliberate trade-off: this means every device tracks its own session row, which is more storage and more bookkeeping than a single `userId → token` mapping, but it's what makes "log out my phone without logging out my laptop" and "one device's token gets stolen, only that device's blast radius matters *unless* reuse is detected" both possible. Reuse detection is intentionally the exception to per-device scoping: a replayed old token triggers a full account-wide logout, on the theory that if a rotated-out token resurfaces, something more consequential than one lost device has happened.

## Separate secrets for access and refresh tokens

`JWT_SECRET` and `JWT_REFRESH_SECRET` are different values so a leak of one doesn't let an attacker forge the other token type. This is a small amount of extra config-management overhead in exchange for blast-radius containment — a deliberate defense-in-depth choice given how consequential a forged refresh token would be (a long-lived, cookie-borne credential) versus a forged access token (short-lived, still requires bypassing whatever's checking the header).

## Password pepper stored outside the database

Argon2id already salts per-hash, but a server-side pepper (`PASSWORD_PEPPER`, environment config, not the DB) is appended before hashing. The trade-off here is explicit: a full database dump alone is *not* enough to attack the hashes, because the pepper never leaves environment config. This raises operational cost (the pepper needs its own secure storage/rotation story, which the docs flag is currently undocumented) in exchange for meaningfully raising the bar on the most common real-world breach scenario (DB exfiltration without server/env access).

## SSE for live email-verification status, not polling

Rather than having the frontend poll "am I verified yet?", `/auth/verify-status` holds an SSE connection open, gated by a short-lived, single-use session token (not just an email address, to close off enumeration). The harder problem this created: with two stateless API replicas behind nginx, the connection holding the SSE stream and the request that completes verification can land on different replicas. The chosen fix was Redis Pub/Sub (`sse:notify`) fanning out to every replica, with each replica keeping its own in-memory `Map` of held connections and no-oping on events it doesn't own. The alternative — sticky sessions at the load balancer — was not chosen, likely because it would tie a specific class of request to replica affinity for the whole app rather than isolating the constraint to just this one flow.

## Redis Stack, not vanilla Redis

The choice of Redis *Stack* rather than plain Redis is driven entirely by two command families used on the hot paths: `BF.*` (Bloom filter, redirect existence check) and `PF*` (HyperLogLog, unique visitor counting). Both could theoretically be reimplemented in application code, but doing so would move probabilistic-structure logic (and its associated correctness subtleties) out of a battle-tested Redis module and into custom code maintained by this project — a trade this codebase explicitly avoided.

## Analytics: pre-aggregated buckets, not a document-per-click

`ClickBucket` is one document per URL per day, with counters incremented into Mongo `Map` fields — a deliberate move away from one-row-per-click. At any real scale, one-row-per-click means the collection grows unboundedly with traffic and every analytics query becomes an aggregation over potentially millions of rows. Pre-aggregating trades write-side complexity (a Redis buffering layer, a flush job, dimension-count reconstruction) for read-side simplicity and a collection size that scales with (URLs × days), not (URLs × clicks).

## Minute-bucketed Redis keys, not one mutable key per day

Early on, the natural design would be a single Redis key per `(urlId, date)`, incremented all day and flushed once. That has a real race: a flush job reading-then-deleting the key can lose an increment that lands in the same instant. Splitting into per-minute keys (`analytics:{urlId}:{date}:{HH:MM}`) sidesteps the race entirely — a bucket only ever receives writes during its own 60-second window (plus a grace period), so once that window's passed, nothing will ever write to it again, and the flush job can safely claim and delete it without a lock. The cost is more Redis keys and a slightly more involved flush loop; the benefit is a flush cadence that can run every minute instead of once a day without introducing a race that a daily cadence would rarely hit but a per-minute cadence would hit constantly.

## Claim-then-flush via atomic `RENAME`, not read-then-delete

The flush job doesn't just read a due bucket and delete it — it first atomically renames `analytics:{...}` to `processing:{...}` via a Lua script, moving the key from an `analytics:active` set to a `processing:active` sorted set scored by claim time. This was a direct response to a durability gap: a naive read-then-flush-then-delete leaves a window where a crash between "read" and "commit" loses that bucket's data with nothing to recover it. The `RENAME` approach guarantees the data exists under exactly one key at every instant — never duplicated, never gone — so a crash just leaves it "claimed" instead of losing it, and a separate recovery job (`analyticsRecoveryWorker.js`, sweeping `processing:active` for stale claims every 5 minutes) can safely re-run the flush. The trade-off is added mechanism (a Lua script, a second Redis key namespace, a second cron job) for a guarantee that a simpler design couldn't provide.

## `ShortUrl.clicks` and `ClickBucket` written in one transaction, not two pipelines

`ShortUrl.clicks` (a denormalized counter for "sort by popularity") used to be fed by its own independent Redis buffer and cron job. That was collapsed into a single write path: `flushClaimedKey` now `$inc`s both `ClickBucket` and `ShortUrl.clicks` inside one MongoDB transaction, from the same aggregated numbers. The original two-pipeline design optimized for pipeline independence (a slow/broken click-count flush couldn't block analytics, or vice versa); the current design optimizes for correctness (the two numbers can no longer disagree) at the cost of that independence — a crash inside the transaction now affects both together rather than just one. Given both numbers derive from the exact same click events, consistency was judged more valuable than isolating their failure modes.

## `$inc`, not `$set`, on `ClickBucket` writes

Because each flush now carries only one minute's fragment of a day's data, writing with `$set` would clobber every earlier flush for that date. `$inc` accumulates instead. The one exception is `uniqueVisitors`, which stays `$set` — it's re-read fresh from the day's HyperLogLog archive on every flush (which already reflects the *whole* day's cardinality so far, not just the latest fragment), so summing it via `$inc` would double-count.

## Two dedicated worker processes, not one

`clickWorker` and `emailWorker` are separate processes (and separate Docker services), not two job types processed by one worker. The reasoning: a slow or misbehaving email provider (rate limits, timeouts, an outage at Resend) should never be able to back up click processing, and a burst of click volume should never delay a password-reset email. Splitting them costs more container/process overhead (two images, two things to monitor, two sets of resource limits) in exchange for failure and load isolation between two workloads with very different latency/volume profiles.

## In-process concurrency limiting, deliberately not Redis-backed

Unlike the per-IP rate limiters (which are Redis-backed so multiple replicas share state), the global `concurrencyLimiter` is a plain in-process counter. This was a deliberate choice, not an oversight — its job is to protect *this* process's event loop and *this* process's downstream connection pools, so it needs to reflect this replica's actual concurrent load. A Redis-backed cluster-wide counter would answer a different question ("is the whole cluster overloaded?") than the one this limiter is meant to answer ("is this process about to fall over?"), and would add a Redis round-trip to every single request for no corresponding benefit.

## Rate limiting keyed by what's actually being protected, not one blanket scheme

Every limiter in `rateLimiter.js` is keyed differently, on purpose: login by IP+email (catches both credential-stuffing-across-emails and botnet-across-IPs), refresh by IP+deviceId, email-sending endpoints by the *target* email (so an attacker can't email-bomb a victim by rotating IPs), shorten split by authenticated/anonymous with different caps. A single generic "N requests per IP" limiter would have been much less code, but would leave each of these specific abuse patterns only partially covered — the extra per-route design cost was accepted in exchange for limiters that actually match their threat model.

## Two-phase existence checks favor "fail open" on the redirect path specifically

The Bloom filter check fails open on Redis errors — if Redis is unreachable, the redirect path falls straight through to the real Mongo lookup rather than 404ing or erroring. This is consistent with the broader philosophy that the redirect path should degrade gracefully rather than fail hard: a probabilistic pre-filter going down should cost some latency (falling back to the thing it was optimizing away), not take down redirects.