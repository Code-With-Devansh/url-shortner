import redis from "../config/redis.config.js";

const DEFAULT_TTL = 120; 

export async function withCache(key, ttlSeconds = DEFAULT_TTL, fn) {
  const cached = await redis.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // corrupted cache entry — fall through to recompute
    }
  }

  const fresh = await fn();

  // Fire-and-forget the cache write — don't make the response wait on it
  if (fresh !== undefined && fresh !== null) {
    redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds).catch(() => {});
  }

  return fresh;
}

// ---------------------------------------------------------------------------
// Cache stampede protection — used ONLY by the redirect path
// (GET /:shortId), not analytics. Worth the extra complexity here
// specifically because the redirect route is the highest-traffic,
// lowest-latency-budget route in the app: a popular short link's cache
// entry expiring under load is exactly the "10,000 requests, one key"
// scenario, and it's hitting the route visitors actually wait on.
//
// Three layers, cheapest first:
//
//   1. In-process single-flight — concurrent calls to the SAME key on the
//      SAME replica share one in-flight promise. Free (no Redis round trip),
//      and on its own already collapses most of the fan-in: with 2 API
//      replicas, this alone takes "10,000 requests" down to "2 calls to
//      fn(), one per replica" before Redis is even involved.
//
//   2. Stale-while-revalidate — the cached value carries its own
//      `freshUntil` timestamp, independent of the Redis key's physical TTL
//      (which is set longer). When a value goes stale, callers get the
//      stale value back IMMEDIATELY (it's still correct, just not the
//      latest), while exactly one caller refreshes it in the background.
//      Nobody blocks on a Mongo query just because a timer expired.
//
//   3. Redis SETNX lock — only reached on a true cache miss (key doesn't
//      exist in Redis at all: first request ever, or evicted) or when
//      refreshing a stale value. Collapses the cross-replica case (one
//      in-flight call per replica, from layer 1) down to exactly one
//      fn() call cluster-wide. Losers poll briefly for the winner's
//      result; if the winner doesn't finish in time (e.g. it crashed
//      after taking the lock), losers fall through and call fn()
//      themselves rather than wait forever — correctness over
//      cleverness if anything goes wrong.
// ---------------------------------------------------------------------------

// How much longer the physical Redis key lives past the value's declared
// freshness window. This is what creates the "stale but present" state that
// layer 2 depends on — without this gap, every expiry is an instant hard
// miss and we'd be back to locking on every single expiry instead of just
// the rare ones where the stale-serving window also lapsed.
export const STALE_GRACE_SECONDS = 30;

// Per-process map of key -> in-flight Promise. This is intentionally a
// plain in-memory Map, not Redis-backed — its only job is deduplicating
// concurrent callers on THIS process, same philosophy as the concurrency
// limiter elsewhere in the codebase.
const inFlight = new Map();

const LOCK_TTL_MS = 5000; // safety net if the lock holder dies mid-refresh
const POLL_INTERVAL_MS = 50;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquireLock(lockKey) {
  // NX + PX in one atomic call: only succeeds if the key doesn't exist yet.
  const result = await redis.set(lockKey, "1", "PX", LOCK_TTL_MS, "NX");
  return result === "OK";
}

async function releaseLock(lockKey) {
  await redis.del(lockKey).catch(() => {});
}

export async function readEnvelope(key) {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "value" in parsed &&
      "freshUntil" in parsed
    ) {
      return parsed;
    }
    return null; // unexpected shape — treat as absent, not a crash
  } catch {
    return null; // corrupted entry — treat as absent
  }
}

export async function writeEnvelope(key, value, ttlSeconds, negativeTtlSeconds) {
  // `undefined` means "fn produced nothing meaningful" — don't cache that.
  // `null` is a legitimate, cacheable result (e.g. "this short URL doesn't
  // exist / is inactive") — caching it matters just as much as caching a
  // hit, since otherwise every request for a bad slug skips the cache
  // entirely and hits Mongo (and takes the lock-wait path) every time.
  // It gets its own (shorter) TTL when the caller provides one, since a
  // "not found" result going stale matters less than a real value going
  // stale, but staying wrong for as long as a real hit's TTL is too long —
  // e.g. a slug created moments after a failed lookup shouldn't be stuck
  // behind a day-old negative cache entry.
  if (value === undefined) return;
  const effectiveTtl =
    value === null && negativeTtlSeconds !== undefined
      ? negativeTtlSeconds
      : ttlSeconds;
  const envelope = {
    value,
    freshUntil: Date.now() + effectiveTtl * 1000,
  };
  const physicalTtl = effectiveTtl + STALE_GRACE_SECONDS;
  // Fire-and-forget — don't make the caller wait on the cache write.
  redis.set(key, JSON.stringify(envelope), "EX", physicalTtl).catch(() => {});
}

/**
 * Like `withCache`, but with stampede protection. for hot,
 * latency-sensitive keys (currently: the redirect path's URL cache) \
 *
 * @param {string} key
 * @param {number} ttlSeconds   how long the value is considered FRESH.
 *                               (the physical Redis key lives a bit longer
 *                               than this — see STALE_GRACE_SECONDS — so a
 *                               just-expired value can still be served
 *                               stale while it's refreshed in the background)
 * @param {() => Promise<any>} fn   recomputes the value on a true miss
 * @param {object} [opts]
 * @param {number} [opts.lockWaitMs=150] max time a loser will wait/poll for
 *                               the winner's refresh before giving up and
 *                               calling fn() itself. Kept short by default
 *                               since this is meant for latency-sensitive
 *                               paths.
 * @param {number} [opts.negativeTtlSeconds] if fn() resolves to `null`,
 *                               cache it with this TTL instead of
 *                               ttlSeconds. Use a short value for
 *                               "not found" results so they don't outlive
 *                               how long the absence is likely to stay true.
 */
export async function withStampedeProtection(key, ttlSeconds = DEFAULT_TTL, fn, opts = {}) {
  const { lockWaitMs = 150, negativeTtlSeconds } = opts;

  // Layer 1: in-process single-flight. If another call on this replica is
  // already resolving this exact key, piggyback on it instead of doing any
  // work (not even a Redis read) ourselves.
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = resolveValue(key, ttlSeconds, fn, lockWaitMs, negativeTtlSeconds);
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    // Only this call's own promise gets cleared, not whichever one happens
    // to be in the map (a new in-flight call for the same key may have
    // already replaced it by the time we get here).
    if (inFlight.get(key) === promise) {
      inFlight.delete(key);
    }
  }
}

async function resolveValue(key, ttlSeconds, fn, lockWaitMs, negativeTtlSeconds) {
  const cached = await readEnvelope(key);
  const now = Date.now();

  if (cached) {
    if (now < cached.freshUntil) {
      // Fresh hit — fast path, no lock, no fn() call.
      return cached.value;
    }
    // Stale-but-present: serve what we have immediately, refresh in the
    // background. The caller never waits on this.
    refreshInBackground(key, ttlSeconds, fn, negativeTtlSeconds);
    return cached.value;
  }

  // True miss — key doesn't exist at all. This is the one case that's
  // allowed to make the caller wait, and only up to lockWaitMs.
  return refreshAndWait(key, ttlSeconds, fn, lockWaitMs, negativeTtlSeconds);
}

function refreshInBackground(key, ttlSeconds, fn, negativeTtlSeconds) {
  const lockKey = `lock:${key}`;
  // Don't await this — it's explicitly fire-and-forget from the caller's
  // perspective. Errors are swallowed: a failed background refresh just
  // means the stale value keeps being served until the next attempt,
  // which is the correct degraded behavior, not a crash.
  (async () => {
    const acquired = await acquireLock(lockKey).catch(() => false);
    if (!acquired) return; // someone else is already refreshing this key
    try {
      const fresh = await fn();
      await writeEnvelope(key, fresh, ttlSeconds, negativeTtlSeconds);
    } catch {
      // swallow — see comment above
    } finally {
      await releaseLock(lockKey);
    }
  })();
}

async function refreshAndWait(key, ttlSeconds, fn, lockWaitMs, negativeTtlSeconds) {
  const lockKey = `lock:${key}`;
  const acquired = await acquireLock(lockKey).catch(() => false);

  if (acquired) {
    try {
      const fresh = await fn();
      await writeEnvelope(key, fresh, ttlSeconds, negativeTtlSeconds);
      return fresh;
    } finally {
      await releaseLock(lockKey);
    }
  }

  // Lost the race to another replica's request for the same key. Poll
  // briefly for it to finish and populate the cache, rather than also
  // hitting Mongo ourselves.
  const deadline = Date.now() + lockWaitMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const cached = await readEnvelope(key);
    if (cached) return cached.value;
  }

  // Winner didn't finish in time (slow query, or it crashed holding the
  // lock until LOCK_TTL_MS expires) — fall through and do the work
  // ourselves rather than wait indefinitely. Correctness over cleverness.
  const fresh = await fn();
  await writeEnvelope(key, fresh, ttlSeconds, negativeTtlSeconds);
  return fresh;
}