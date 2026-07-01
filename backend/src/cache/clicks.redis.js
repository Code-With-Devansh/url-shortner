import redis from "../config/redis.config.js";


export const incrementClickCountToRedis = async (urlId) => {
  await redis.hincrby("clicks", urlId, 1);
};