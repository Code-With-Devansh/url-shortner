import redis from "../config/redis.config.js";
import crypto from "crypto";

export const minuteBucketKey = (urlId, date, minute) =>
  `analytics:${urlId}:${date}:${minute}`;

export const hllKeyForBucket = (bucketKey) => `${bucketKey}:visitors`;

export const activeSetKeyForUrl = (urlId) => `analytics:active:${urlId}`;

export const ANALYTICS_DUE_ZSET = "analytics:due";

export const liveUserTotalKey = (userId) => `analytics:live:total:${userId}`;
export const liveLeaderboardKey = (userId) => `analytics:live:${userId}`;

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

export const archiveMinuteHll = async (
  urlId,
  date,
  minute,
  retentionSeconds,
  deleteSource = true,
) => {
  const source = hllKeyForBucket(minuteBucketKey(urlId, date, minute));
  const exists = await redis.exists(source);
  if (!exists) return;

  const archive = hllArchiveKey(urlId, date);
  await redis.pfmerge(archive, archive, source);
  await redis.expire(archive, retentionSeconds);
  if (deleteSource) {
    await redis.del(source);
  }
};

export const mergeUniqueVisitors = async (keys) => {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return 0;

  if (uniqueKeys.length === 1) {
    return redis.pfcount(uniqueKeys[0]);
  }

  const scratchKey = `tmp:hllmerge:${crypto.randomUUID()}`;

  try {
    const [, , count] = await redis
      .multi()
      .pfmerge(scratchKey, ...uniqueKeys)
      .expire(scratchKey, 30)
      .pfcount(scratchKey)
      .exec();

    return count;
  } finally {
    await redis.del(scratchKey).catch(() => {});
  }
};

export const saveClickToRedis = async ({
  urlId,
  userId,
  ua,
  visitorHash,
  country,
  referer,
  timestamp,
}) => {
  const dateObj = new Date(timestamp);
  const date = dateObj.toISOString().split("T")[0];
  const hour = dateObj.getUTCHours().toString().padStart(2, "0");
  const minute = minuteOf(timestamp);
  const key = minuteBucketKey(urlId, date, minute);
  const hllKey = hllKeyForBucket(key);
  const pipeline = redis.multi();
  if (userId) {
    pipeline.hsetnx(key, "userId", userId.toString());
  }
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

  if (userId) {
    pipeline.incr(liveUserTotalKey(userId));
    pipeline.zincrby(liveLeaderboardKey(userId), 1, urlId.toString());
  }

  await pipeline.exec();
};

export const getLiveUserTotal = async (userId) => {
  const value = await redis.get(liveUserTotalKey(userId));
  return Number(value) || 0;
};
export const getLiveActiveUrlIds = async (userId) => {
  return redis.zrange(liveLeaderboardKey(userId), 0, -1);
};

export const getLiveLeaderboardTop = async (userId, limit) => {
  const raw = await redis.zrevrange(liveLeaderboardKey(userId), 0, limit - 1, "WITHSCORES");
  const totals = {};
  for (let i = 0; i < raw.length; i += 2) {
    totals[raw[i]] = Number(raw[i + 1]) || 0;
  }
  return totals;
};

// Called at flush time to subtract exactly what was just persisted to Mongo.
// Safe to run as plain (non-Lua) commands: by this point the bucket has
// already been claimed/renamed exclusively by analyticsClaim.lua, so no
// other writer can still be incrementing it — there's nothing left to race.
export const decrementLiveCounters = async ({ urlId, userId, clicks }) => {
  if (!userId || !clicks) return;
  const key = liveLeaderboardKey(userId);
  const pipeline = redis.multi();
  pipeline.decrby(liveUserTotalKey(userId), clicks);
  pipeline.zincrby(key, -clicks, urlId.toString());
  const results = await pipeline.exec();

  const newScore = Number(results?.[1]?.[1]);
  if (!Number.isNaN(newScore) && newScore <= 0) {
    await redis.zrem(key, urlId.toString());
  }
};