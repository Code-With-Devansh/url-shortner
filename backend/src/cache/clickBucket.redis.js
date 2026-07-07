import redis from "../config/redis.config.js";
import crypto from "crypto";

export const minuteBucketKey = (urlId, date, minute) =>
  `analytics:${urlId}:${date}:${minute}`;

export const hllKeyForBucket = (bucketKey) => `${bucketKey}:visitors`;


export const activeSetKeyForUrl = (urlId) => `analytics:active:${urlId}`;

export const ANALYTICS_DUE_ZSET = "analytics:due";

export const minuteOf = (timestampMs = Date.now()) => {
  const d = new Date(timestampMs);
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
};


export const bucketDueAt = (date, minute) =>
  Date.parse(`${date}T${minute}:00.000Z`) + 60_000;

export const isBucketDueForFlush = (date, minute, graceMs = 60_000) => {
  return Date.now() >= bucketDueAt(date, minute) + graceMs;
};

export const getActiveBucketKeysForDate = async (urlId, date) => {
  const prefix = `analytics:${urlId}:${date}:`;
  const active = await redis.smembers(activeSetKeyForUrl(urlId));
  return active.filter((k) => k.startsWith(prefix) && !k.endsWith(":visitors"));
};

export const getActiveBucketKeysForUrls = async (urlIds, date) => {
  if (urlIds.length === 0) return [];
  const setKeys = urlIds.map((id) => activeSetKeyForUrl(id));
  const active = await redis.sunion(...setKeys);
  return active.filter((k) => {
    if (k.endsWith(":visitors")) return false;
    const parts = k.split(":");
    if (parts.length < 5) return false;
    const [, , kDate] = parts;
    return kDate === date;
  });
};

export const hllArchiveKey = (urlId, date) => `analytics:hll:${urlId}:${date}`;

export const archiveMinuteHll = async (urlId, date, minute, retentionSeconds) => {
  const source = hllKeyForBucket(minuteBucketKey(urlId, date, minute));
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
  timestamp,
) => {
  const dateObj = new Date(timestamp);
  const date = dateObj.toISOString().split("T")[0];
  const hour = dateObj.getUTCHours().toString().padStart(2, "0");
  const minute = minuteOf(timestamp);
  const key = minuteBucketKey(urlId, date, minute);
  const hllKey = hllKeyForBucket(key);
  const pipeline = redis.multi();

  pipeline.hincrby(key, "total", 1);
  pipeline.hincrby(key, `country:${country}`, 1);
  pipeline.hincrby(key, `device:${ua.device.type || "Desktop"}`, 1);
  pipeline.hincrby(key, `browser:${ua.browser.name || "Unknown"}`, 1);
  pipeline.hincrby(key, `os:${ua.os.name || "Unknown"}`, 1);
  pipeline.hincrby(key, `referer:${referer}`, 1);
  pipeline.hincrby(key, `hour:${hour}`, 1);
  pipeline.expire(key, 172800, "NX");
  pipeline.pfadd(hllKey, visitorHash);
  pipeline.expire(hllKey, 172800, "NX");
  pipeline.sadd(activeSetKeyForUrl(urlId), key);
  pipeline.zadd(ANALYTICS_DUE_ZSET, bucketDueAt(date, minute), key);

  await pipeline.exec();
};


export const getLiveTotalsByUrl = async (urlIds, date) => {
  const keys = await getActiveBucketKeysForUrls(urlIds, date);
  if (keys.length === 0) return {};

  const pipeline = redis.pipeline();
  keys.forEach((key) => pipeline.hget(key, "total"));
  const results = await pipeline.exec();

  const totals = {};
  keys.forEach((key, i) => {
    // key shape: analytics:<urlId>:<date>:<HH:MM>
    const urlId = key.split(":")[1];
    const [err, value] = results[i];
    const count = err ? 0 : Number(value) || 0;
    totals[urlId] = (totals[urlId] || 0) + count;
  });

  return totals;
};  