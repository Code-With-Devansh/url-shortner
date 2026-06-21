import { saveClickBucket } from "../../dao/clickBucket.dao.js";
import redis from "../../config/redis.config.js";
import { invalidateAnalyticsCache } from "../../utils/cacheKeys.js";
const RETENTION_DAYS = 90;

export async function flushAnalyticsKey(key) {
  const data = await redis.hGetAll(key);

  if (!data || Object.keys(data).length === 0) {
    await redis.sRem("analytics:active", key); // clean up the set too
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

  const hllKey = `analytics:${urlId}:${date}:visitors`;
  const uniqueVisitors = await redis.pfCount(hllKey);
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

  await redis.del([key, hllKey]);
  await redis.sRem("analytics:active", key);

  await invalidateAnalyticsCache(urlId);
}
