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

  pipeline.hincrby(key, "total", 1);
  pipeline.hincrby(key, `country:${country}`, 1);
  pipeline.hincrby(key, `device:${ ua.device.type || "Unknown"}`, 1);
  pipeline.hincrby(key, `browser:${ua.browser.name || "Unknown" }`, 1);
  pipeline.hincrby(key, `os:${ua.os.name || "Unknown"}`, 1);
  pipeline.hincrby(key, `referer:${referer}`, 1);
  pipeline.hincrby(key, `hour:${hour}`, 1);
  pipeline.expire(key, 172800, "NX");
  pipeline.pfadd(hllKey, visitorHash);
  pipeline.expire(hllKey, 172800, "NX");
  pipeline.sadd("analytics:active", key);

  await pipeline.exec();
};
