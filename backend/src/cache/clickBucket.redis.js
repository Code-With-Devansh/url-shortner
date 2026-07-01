import redis from "../config/redis.config.js";

export const liveHllKey = (urlId, date) => `analytics:${urlId}:${date}:visitors`;
export const hllArchiveKey = (urlId, date) => `analytics:hll:${urlId}:${date}`;
export const archiveHllForDate = async (urlId, date, retentionSeconds) => {
  const source = liveHllKey(urlId, date);
  const exists = await redis.exists(source);
  if (!exists) return;

  const archive = hllArchiveKey(urlId, date);
  await redis.pfmerge(archive, archive, source);
  await redis.expire(archive, retentionSeconds);
  await redis.del(source);
};

export const mergeUniqueVisitors = async (keys) => {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return 0;

  const existing = [];
  for (const key of uniqueKeys) {
    if (await redis.exists(key)) existing.push(key);
  }
  if (existing.length === 0) return 0;
  if (existing.length === 1) return await redis.pfcount(existing[0]);

  const scratchKey = `tmp:hllmerge:${crypto.randomUUID()}`;
  try {
    await redis.pfmerge(scratchKey, ...existing);
    return await redis.pfcount(scratchKey);
  } finally {
    await redis.del(scratchKey).catch(() => {});
  }
};

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
