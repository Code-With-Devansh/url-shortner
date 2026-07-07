import redis from "../config/redis.config.js";
import { findShortUrl } from "../dao/shortUrl.js";

export const URL_CACHE_PREFIX = "cache:url:";
export const URL_CACHE_TTL = 60 * 60 * 24; // 24 hours
export const urlCacheKey = (shortCode) => `${URL_CACHE_PREFIX}${shortCode}`;

export async function invalidateAnalyticsCache(urlId) {
  // Previously gated on `redis.exists("cache:analytics:url:<urlId>:30d:summary")`
  // — a key no function in this codebase ever actually writes (real keys
  // look like `cache:analytics:url:<urlId>:<range>:mongo-buckets`, for
  // whatever range was requested, never a hardcoded "30d" + "summary").
  // That check was always false, so this function returned immediately on
  // every call and never invalidated anything. Just always attempt the
  // deletes — deleteByPattern is already a no-op if nothing matches.
  await deleteByPattern(`cache:analytics:url:${urlId}:*`);

  const url = await findShortUrl(urlId);
  if (url?.user) {
    // Scope name here must match analyticsCacheKey("user", userId, ...)
    // used when WRITING these keys in analytics.service.js — this used to
    // say "overall", a scope that's never actually used anywhere, so this
    // branch also silently invalidated nothing even once reached.
    await deleteByPattern(`cache:analytics:user:${url.user}:*`);
  }
}

async function deleteByPattern(pattern) {
  let cursor = "0";
  do {
    // ioredis's scan() resolves to a plain [nextCursor, keys] tuple, not
    // the { cursor, keys } object shape from node-redis v4 — destructuring
    // it that way previously threw on every call (`keys` was `undefined`,
    // so `keys.length` below crashed), meaning this function never got
    // past its first iteration regardless of what called it.
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    if (keys.length) await redis.del(keys);
    cursor = next;
  } while (cursor !== "0");
}


export const analyticsCacheKey = (scope, id, range, extra = "") =>
  `cache:analytics:${scope}:${id}:${range}${extra ? ":" + extra : ""}`;