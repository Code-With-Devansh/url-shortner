
import redis from '../config/redis.config.js'

const PREFIX = "url:";

export const getCachedUrl = async (shortCode) => {
  return redis.get(PREFIX + shortCode);
};

export const cacheUrl = async (shortCode, originalUrl) => {
  await redis.set(
    PREFIX + shortCode,
    originalUrl,{
        EX: 60 * 60 * 24,
    }
  );
};

export const deleteCachedUrl = async(shortCode)=>{
    await redis.del(PREFIX + shortCode)
}