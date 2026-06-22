import redis from '../config/redis.config.js'
import { urlCacheKey, URL_CACHE_TTL } from '../utils/cacheKeys.js'

export const getCachedUrl = async (shortCode) => {
  const cached = await redis.get(urlCacheKey(shortCode));
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
};

export const cacheUrl = async (shortCode, shortUrlObj) => {
  await redis.set(urlCacheKey(shortCode), JSON.stringify(shortUrlObj), {
    EX: URL_CACHE_TTL,
  });
};

export const deleteCachedUrl = async (shortCode) => {
  await redis.del(urlCacheKey(shortCode))
}
