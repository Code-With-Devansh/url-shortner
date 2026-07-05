import redis from "../config/redis.config.js";
import { urlCacheKey, URL_CACHE_TTL } from "../utils/cacheKeys.js";
import { writeEnvelope } from "../utils/withCache.js";

export const getCachedUrl = async (shortCode) => {
  const envelope = await readEnvelope(urlCacheKey(shortCode));
  if (!envelope) return null;
  return envelope.value;
};
export const cacheUrl = async (shortCode, shortUrlObj) => {
  await writeEnvelope(urlCacheKey(shortCode), shortUrlObj, URL_CACHE_TTL);
};

export const deleteCachedUrl = async (shortCode) => {
  await redis.del(urlCacheKey(shortCode));
};

