import redis from "../config/redis.config.js";
import { findShortUrl } from "../dao/shortUrl.js";

export const URL_CACHE_PREFIX = "cache:url:";
export const URL_CACHE_TTL = 60 * 60 * 24; // 24 hours
export const urlCacheKey = (shortCode) => `${URL_CACHE_PREFIX}${shortCode}`;

export async function invalidateAnalyticsCache(urlId) {
  const exists = await redis.exists(`cache:analytics:url:${urlId}:30d:summary`);
  if (!exists) return;

  await deleteByPattern(`cache:analytics:url:${urlId}:*`);

  const url = await findShortUrl(urlId);
  if (url?.user) {
    await deleteByPattern(`cache:analytics:overall:${url.user}:*`);
  }
}

async function deleteByPattern(pattern) {
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    if (keys.length > 0) {
      await redis.unlink(...keys);
    }

    cursor = nextCursor;
  } while (cursor !== "0");
}

export const analyticsCacheKey = (scope, id, range, extra = "") =>
  `cache:analytics:${scope}:${id}:${range}${extra ? ":" + extra : ""}`;
