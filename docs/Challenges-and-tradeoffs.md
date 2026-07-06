# Challenges and Trade-offs

A running log of specific problems this codebase actually ran into, how they were resolved, and what was traded away to resolve them. Where `design-decisions.md` explains the architecture as a whole, this document is closer to a debugging/incident history — concrete bugs, races, and design tensions, in roughly the order they surface when reading the code.

## The `rate-limit-redis` key corruption bug

**Problem:** Production Redis accumulated keys like `login[object Object]:someone@example.com` and `refresh[object Object]:...`. The root cause: `keyGenerator` callbacks in `rateLimiter.js` called `ipKeyGenerator(req)` — passing the whole Express request object — instead of `ipKeyGenerator(req.ip)`. `express-rate-limit` v7+'s `ipKeyGenerator` expects an IP **string** to normalize (handling IPv6/IPv4 equivalence and subnet masking); handed an object instead, it coerced to the literal string `"[object Object]"`.

**Why it wasn't caught earlier:** `commonConfig.skip = skipInDev`, so every rate limiter is skipped entirely in local development. The buggy code path never actually executed outside production — dev "working" was really dev never running this code at all, not evidence of correctness.

**Trade-off exposed by the fix:** the fix (`ipKeyGenerator(req.ip)`) is strictly better with no real downside, but the incident is a reminder that `skip`-based dev/prod branching means anything gated behind it is *unverified*, not *verified-and-passing*, until it's actually exercised somewhere. No test currently exercises rate limiter key generation directly.

**Four separate instances found**, not one — `login`, `email` (fallback branch only), `refresh`, and `api` limiters all had the same pattern; a single-instance mental model of the bug would have missed three of them.

## `ShortUrl.clicks` vs `ClickBucket`: independent pipelines vs. one write path

**Problem:** these two numbers are meant to represent the same underlying fact (how many times a URL has been clicked) but were originally fed by two independent Redis buffers and two independently-scheduled cron jobs. They were only guaranteed to *eventually* converge, not agree at any given instant — which is a reasonable trade-off in isolation, but meant "why don't these two numbers match" was a standing, unresolved question rather than a bug that could be fixed once.

**Resolution and its cost:** collapsing to one write path (`flushClaimedKey` writing both inside a single MongoDB transaction) removes the divergence entirely, but couples the two counters' failure modes together — a transaction failure now affects both `ClickBucket` and `ShortUrl.clicks` at once, where before a `ShortUrl.clicks` flush failure couldn't touch analytics data and vice versa. This was judged the right trade because the numbers deriving from the same click events made independent failure modes a cost with no corresponding benefit — but it's worth naming explicitly as a trade-off, not a strict improvement with no downside.

## The Redis buffer / MongoDB durability gap

**Problem:** a click landing in a Redis minute-bucket is not durable in the transactional sense — if the process (or Redis itself) crashes between the `HINCRBY` and the eventual flush, that data could be lost with no way to detect or replay it. A naive read-then-delete flush pattern also has a narrower but related race: reading a bucket and then deleting it can lose a concurrent write landing in the same instant.

**Two separate races, one mechanism:** the per-minute bucketing (rather than one mutable per-day key) already solves the second race — a bucket stops receiving writes once its 60-second window plus grace period has passed, so claim-then-delete is safe with no lock needed. The first, harder problem (process/Redis crash between click and flush) required an actual durability mechanism: an atomic `RENAME`-based claim (Lua script) moving a due bucket from `analytics:active` to `processing:active`, plus a separate recovery worker sweeping for stale claims every 5 minutes.

**What's still not covered:** the recovery mechanism protects the window *between claim and commit*. It does not protect a bucket that hasn't been claimed yet — if Redis itself loses data (misconfigured persistence, an unclean restart with AOF disabled) before a bucket becomes due, that data is still gone with no replay path. This is a genuine remaining gap, not a solved problem, and depends on Redis persistence actually being configured as intended in production — something this codebase's docs flag as worth confirming rather than assuming.


## Cross-replica SSE: correctness vs. simplicity

**Problem:** the email-verification "live status" feature needs to notify a specific open connection the instant verification completes — but with two stateless API replicas behind nginx, the connection holding that SSE stream and the request completing verification can land on different processes.

**Two approaches considered (implicitly, by what was and wasn't built):** sticky sessions at the load balancer would guarantee affinity without any pub/sub machinery, but would tie a load-balancing decision meant for one narrow feature to the whole app's routing, and would break the "N stateless replicas" property the rest of the system depends on. The chosen approach — Redis Pub/Sub fan-out, each replica holding its own in-memory connection map and no-oping on events it doesn't own — keeps every replica interchangeable at the cost of a pub/sub channel and slightly more complex reasoning about "which replica actually has this connection right now." Given the rest of the architecture (rate limiting, sessions, caching) already depends on replicas being interchangeable, this was consistent with the rest of the system rather than a one-off complication.

## Bloom filter: probabilistic correctness vs. exact correctness

**Problem/tension:** a Bloom filter can false-positive (say "might exist" for a slug that doesn't) but never false-negative (never say "doesn't exist" for one that does) — which is exactly the asymmetry needed to safely short-circuit only the negative case. The trade-off accepted here is that the filter can drift out of sync with reality if Redis loses data independently of Mongo, at which point every redirect briefly costs an extra (harmless but unnecessary) Mongo round-trip until the filter is rebuilt — never a correctness problem, only a performance one, which is why a manual rebuild script rather than automatic reconciliation was judged sufficient.

## Cache invalidation granularity vs. cost

**Problem/tension:** `invalidateAnalyticsCache` runs a `SCAN` + delete over every `cache:analytics:url:{urlId}:*` key (and the owner's `overall:*` keys) once per flushed bucket, rather than something more surgical. It short-circuits entirely if there's no existing 30-day summary cache entry for that URL — a cheap way to skip invalidation work for URLs nobody's actively viewing. The trade-off: this is coarser than invalidating exactly the cache entries that changed, but building that precision would mean tracking which specific query shapes are cached for which URL, for a marginal win given TTLs are already short (30s–300s) and today's numbers are read live from Redis regardless.
