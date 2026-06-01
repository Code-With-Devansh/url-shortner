import redis from "../config/redis.config.js";

const PREFIX = "clicks:";

export const incrementClicks = async (shortId) => {
  await redis.hIncrBy("clicks", shortId, 1);
};