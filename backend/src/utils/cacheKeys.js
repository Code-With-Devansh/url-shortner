import redis from "../config/redis.config.js";

export const URL_CACHE_PREFIX = "cache:url:";
export const URL_CACHE_TTL = 60 * 60 * 24; // 24 hours
export const urlCacheKey = (shortCode) => `${URL_CACHE_PREFIX}${shortCode}`;

// Indexed invalidation — replaces the old SCAN MATCH approach.
//
// SCAN MATCH cost scales with the total Redis keyspace, not with the number
// of keys you actually want gone: every invalidation call walks every key
// in the instance looking for matches. An index sidesteps that by
// remembering, at write time, exactly which cache keys belong to a given
// url/user — so invalidation becomes a direct SMEMBERS + DEL instead of a
// keyspace-wide sweep.
//
// This only works if EVERY write of an analytics cache entry goes through
// `setAnalyticsCache` below rather than calling `redis.set` directly — a
// cache entry written without being indexed is a cache entry that
// invalidation will silently never find again, which is exactly the class
// of bug this replaces. There is currently no other writer of
// `cache:analytics:*` keys in this codebase — if one gets added later, it
// must go through this helper too.

const INDEX_TTL = 60 * 60 * 24; // 24h — bounds how long a stale index set
// can linger if its cache entries are never invalidated (e.g. a url that's
// only ever read once and never clicked again). Cache entries themselves
// expire on their own (60s TTL) independent of this; deleting an
// already-expired member via `del` is just a no-op, not an error.

const indexKey = (scope, id) => `cache:index:${scope}:${id}`;

export const analyticsCacheKey = (scope, id, range, extra = "") =>
  `cache:analytics:${scope}:${id}:${range}${extra ? ":" + extra : ""}`;

// Use this instead of a bare `redis.set` wherever an analytics cache entry
// is written, so invalidation always has a record of it.
export async function setAnalyticsCache(scope, id, key, value, ttlSeconds) {
  const idx = indexKey(scope, id);
  await redis.set(key, value, "EX", ttlSeconds);
  await redis.sadd(idx, key);
  await redis.expire(idx, INDEX_TTL);
}

export async function invalidateAnalyticsCache(urlId, userId) {
  await invalidateScope("url", urlId);
  if (userId) {
    // Scope name here must match what setAnalyticsCache was called with
    // when WRITING these keys in analytics.service.js — this used to say
    // "overall", a scope that's never actually used anywhere, so this
    // branch silently invalidated nothing even once reached.
    await invalidateScope("user", userId);
  }
}

async function invalidateScope(scope, id) {
  const idx = indexKey(scope, id);
  const keys = await redis.smembers(idx);
  if (keys.length) await redis.del(...keys);
  await redis.del(idx);
}