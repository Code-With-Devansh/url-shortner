import redis from "../config/redis.config.js";

// All increments go to Redis hash — sub-millisecond, no DB
export const saveClickToRedis = async (
  urlId,
  ua,
  visitorHash,
  country,
  referer,
  date,
  hour,
) => {
  const key = `analytics:${urlId}:${date}`;
  const hllKey = `analytics:${urlId}:${date}:visitors`;
  const pipeline = redis.multi();

  pipeline.hIncrBy(key, "total", 1);
  pipeline.hIncrBy(key, `country:${country}`, 1);
  pipeline.hIncrBy(key, `device:${ ua.device.type || "Unknown"}`, 1);
  pipeline.hIncrBy(key, `browser:${ua.browser.name || "Unknown" }`, 1);
  pipeline.hIncrBy(key, `os:${ua.os.name || "Unknown"}`, 1);
  pipeline.hIncrBy(key, `referer:${referer}`, 1);
  pipeline.hIncrBy(key, `hour:${hour}`, 1);
  pipeline.expire(key, 172800, "NX");
  pipeline.pfAdd(hllKey, visitorHash);
  pipeline.expire(hllKey, 172800, "NX");
  pipeline.sAdd("analytics:active", key);

  await pipeline.exec();
};
