import { saveClickBucket } from "../../dao/clickBucket.dao.js";
import redis from "../../config/redis.config.js";
import { invalidateAnalyticsCache } from "../../utils/cacheKeys.js";
import { archiveHllForDate, hllArchiveKey } from "../../cache/clickBucket.redis.js";
const RETENTION_DAYS = 90;

export async function flushAnalyticsKey(key) {
  const data = await redis.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    await redis.srem("analytics:active", key); // clean up the set too
    return;
  }
  const [, urlId, date] = key.split(":");

  const countries = {};
  const devices = {};
  const browsers = {};
  const os = {};
  const referers = {};
  const hours = {};
  let totalClicks = 0;

  for (const [field, value] of Object.entries(data)) {
    const count = Number(value);
    if (field === "total") totalClicks = count;
    else if (field.startsWith("country:")) countries[field.slice(8)] = count;
    else if (field.startsWith("device:")) devices[field.slice(7)] = count;
    else if (field.startsWith("browser:")) browsers[field.slice(8)] = count;
    else if (field.startsWith("os:")) os[field.slice(3)] = count;
    else if (field.startsWith("referer:")) referers[field.slice(8)] = count;
    else if (field.startsWith("hour:")) hours[field.slice(5)] = count;
  }

  await archiveHllForDate(urlId, date, RETENTION_SECONDS);
  const archiveKey = hllArchiveKey(urlId, date);
   const uniqueVisitors = (await redis.exists(archiveKey))
    ? await redis.pfcount(archiveKey)
    : 0;
  const expireAt = new Date(Date.now() + RETENTION_DAYS * 86400000);

  await saveClickBucket(
    urlId,
    date,
    totalClicks,
    uniqueVisitors,
    countries,
    devices,
    browsers,
    os,
    referers,
    hours,
    expireAt,
  );

  await redis.del(key, hllKey);
  await redis.srem("analytics:active", key);

  await invalidateAnalyticsCache(urlId);
}
