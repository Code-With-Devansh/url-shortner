import redis from "../config/redis.config.js";
import { urlCacheKey, URL_CACHE_TTL } from "../utils/cacheKeys.js";
import {  writeEnvelope } from "../utils/withCache.js";

export const cacheUrl = async (shortCode, shortUrlObj) => {
  await writeEnvelope(urlCacheKey(shortCode), shortUrlObj, URL_CACHE_TTL);
};

export const deleteCachedUrl = async (shortCode) => {
  await redis.del(urlCacheKey(shortCode));
};

