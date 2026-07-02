import { clickQueue } from "../queues/queues.js";
import {
  getBucketsByUrl,
  getBucketsByUrls,
  getUserUrlIds,
  getTopUrlsForUser,
} from "../dao/clickBucket.dao.js";

import { findShortUrlByIdForUser } from "../dao/shortUrl.js";
import { NotFoundError, ValidationError } from "../utils/appError.js";
import { analyticsCacheKey } from "../utils/cacheKeys.js";
import { withCache } from "../utils/withCache.js";
import {getActiveBucketKeysForDate, getActiveBucketKeysForUrls, hllArchiveKey, hllKeyForBucket, mergeUniqueVisitors} from '../cache/clickBucket.redis.js'

const TTL = {
  summary: 30,
  timeseries: 300,
  breakdown: 300,
  leaderboard: 300,
};
const ALLOWED_RANGES = { "7d": 7, "30d": 30, "90d": 90 };
const ALLOWED_BREAKDOWNS = [
  "countries",
  "devices",
  "browsers",
  "os",
  "referers",
  "hours",
];

const toEntries = (mapOrObj) => {
  if (!mapOrObj) return [];
  if (mapOrObj instanceof Map) return [...mapOrObj.entries()];
  return Object.entries(mapOrObj);
};

const sinceDate = (range) => {
  const days = ALLOWED_RANGES[range] ?? ALLOWED_RANGES["30d"];
  return new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
};
const emptyDimensions = () => ({
  countries: {},
  devices: {},
  browsers: {},
  os: {},
  referers: {},
  hours: {},
});

function mergeBuckets(buckets) {
  const summary = { total: 0, uniqueVisitors: 0, ...emptyDimensions() };
  const timeseries = []; // [{ date, total, uniqueVisitors }]

  for (const bucket of buckets) {
    summary.total += bucket.total || 0;
    // NOTE: see "uniqueVisitors across days" caveat below — this sum is an
    // upper bound, not a true unique count across the whole range.

    for (const dim of [
      "countries",
      "devices",
      "browsers",
      "os",
      "referers",
      "hours",
    ]) {
      for (const [key, count] of toEntries(bucket[dim])) {
        summary[dim][key] = (summary[dim][key] || 0) + count;
      }
    }

    timeseries.push({
      date: bucket.date,
      total: bucket.total || 0,
      uniqueVisitors: bucket.uniqueVisitors || 0,
    });
  }

  return { summary, timeseries };
}

const topN = (obj, n = 10) =>
  Object.entries(obj)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);

const validateRange = (range) => {
  if (range && !(range in ALLOWED_RANGES)) {
    throw new ValidationError(
      { range: `range must be one of: ${Object.keys(ALLOWED_RANGES).join(", ")}` },
      ErrorCodes.ANALYTICS_INVALID_RANGE,
    );
  }
  return range || "30d";
};

const validateBreakdown = (by) => {
  if (!ALLOWED_BREAKDOWNS.includes(by)) {
    throw new ValidationError(
      { by: `by must be one of: ${ALLOWED_BREAKDOWNS.join(", ")}` },
      ErrorCodes.ANALYTICS_INVALID_BREAKDOWN,
    );
  }
  return by;
};

export async function recordClick(urlId, ttlDays, req) {
  let referer = "direct";
  try {
    if (req.headers.referer) {
      referer = new URL(req.headers.referer).hostname;
    }
  } catch {}
  await clickQueue.add("click", {
    urlId,
    ttlDays,
    ip: req.headers["x-forwarded-for"]?.split(",")[0],
    userAgent: req.headers["user-agent"],
    referer,
    timestamp: Date.now(),
  });
}
// reads bucket from redis for today only, returns null if no clicks yet today
import redis from "../config/redis.config.js";
import { ErrorCodes } from "../utils/errorCodes.js";

async function aggregateBucketKeys(keys) {
  const countries = {};
  const devices = {};
  const browsers = {};
  const os = {};
  const referers = {};
  const hours = {};
  let total = 0;
  const hllKeys = [];

  for (const key of keys) {
    const data = await redis.hgetall(key);
    for (const [field, value] of Object.entries(data)) {
      const count = Number(value);
      if (field === "total") total += count;
      else if (field.startsWith("country:")) countries[field.slice(8)] = (countries[field.slice(8)] || 0) + count;
      else if (field.startsWith("device:")) devices[field.slice(7)] = (devices[field.slice(7)] || 0) + count;
      else if (field.startsWith("browser:")) browsers[field.slice(8)] = (browsers[field.slice(8)] || 0) + count;
      else if (field.startsWith("os:")) os[field.slice(3)] = (os[field.slice(3)] || 0) + count;
      else if (field.startsWith("referer:")) referers[field.slice(8)] = (referers[field.slice(8)] || 0) + count;
      else if (field.startsWith("hour:")) hours[field.slice(5)] = (hours[field.slice(5)] || 0) + count;
    }
    hllKeys.push(hllKeyForBucket(key));
  }

  return { total, countries, devices, browsers, os, referers, hours, hllKeys };
}

async function getLiveBucketForToday(urlId) {
  const date = new Date().toISOString().split("T")[0];
  const keys = await getActiveBucketKeysForDate(urlId, date);
  if (keys.length === 0) return null;

  const live = await aggregateBucketKeys(keys);
  if (live.total === 0 && live.hllKeys.length === 0) return null;

  return { date, ...live };
}

async function getLiveBucketForUrlsToday(urlIds) {
  const date = new Date().toISOString().split("T")[0];
  const keys = await getActiveBucketKeysForUrls(urlIds, date);
  if (keys.length === 0) return { date, total: 0, hllKeys: [] };

  const live = await aggregateBucketKeys(keys);
  return { date, ...live };
}


// per url
export const getUrlAnalyticsSummary = async (urlId, userId, range) => {
  const url = await findShortUrlByIdForUser(urlId, userId);
  if (!url) throw new NotFoundError("Short URL not found", ErrorCodes.URL_NOT_FOUND);

  const rangeKey = validateRange(range);
  const key = analyticsCacheKey("url", urlId, rangeKey, "summary");

  return withCache(key, TTL.summary, async () => {
    const since = sinceDate(rangeKey);
    const mongoBuckets = await getBucketsByUrl(urlId, since);
    const todayBucket = await getLiveBucketForToday(urlId);
    const allBuckets = todayBucket ? [...mongoBuckets, todayBucket] : mongoBuckets;

    const { summary } = mergeBuckets(allBuckets);
    const hllKeys = mongoBuckets.map((b) => hllArchiveKey(urlId, b.date));
    if (todayBucket) {
      hllKeys.push(...todayBucket.hllKeys);
    }
    const uniqueVisitors = await mergeUniqueVisitors(hllKeys);

    return {
      urlId,
      shortUrl: url.short_url,
      fullUrl: url.full_url,
      range: rangeKey,
      total: summary.total,
      uniqueVisitors,
    };
  });
};

export const getUrlAnalyticsTimeseries = async (urlId, userId, range) => {
  const url = await findShortUrlByIdForUser(urlId, userId);
  if (!url) throw new NotFoundError("Short URL not found", ErrorCodes.URL_NOT_FOUND);

  const rangeKey = validateRange(range);
  const key = analyticsCacheKey("url", urlId, rangeKey, "timeseries");
  return withCache(key, TTL.timeseries, async () => {
    const since = sinceDate(rangeKey);
    const buckets = await getBucketsByUrl(urlId, since);
    const { timeseries } = mergeBuckets(buckets);

    return timeseries;
  });
};

export const getUrlAnalyticsBreakdown = async (urlId, userId, range, by) => {
  const url = await findShortUrlByIdForUser(urlId, userId);
  if (!url) throw new  NotFoundError("Short URL not found", ErrorCodes.URL_NOT_FOUND);

  const rangeKey = validateRange(range);
  const dimension = validateBreakdown(by);
  const key = analyticsCacheKey(
    "url",
    urlId,
    rangeKey,
    `breakdown:${dimension}`,
  );
  return withCache(key, TTL.breakdown, async () => {
    const since = sinceDate(rangeKey);
    const buckets = await getBucketsByUrl(urlId, since);
    const { summary } = mergeBuckets(buckets);

    return topN(summary[dimension]);
  });
};

// overall

export const getOverallAnalyticsSummary = async (userId, range) => {
  const rangeKey = validateRange(range);
  const key = analyticsCacheKey("user", userId, rangeKey, "summary");
  return withCache(key, TTL.summary, async () => {
    const urlIds = await getUserUrlIds(userId);
    if (urlIds.length === 0) {
      return { total: 0, uniqueVisitors: 0, range: rangeKey, topUrl: null };
    }

    const since = sinceDate(rangeKey);
    const [buckets, topUrls, liveToday] = await Promise.all([
      getBucketsByUrls(urlIds, since),
      getTopUrlsForUser(urlIds, since, 1),
      getLiveBucketForUrlsToday(urlIds),
    ]);
    const { summary } = mergeBuckets(buckets);

    const hllKeys = buckets
      .map((b) => hllArchiveKey(b.url_id, b.date))
      .concat(liveToday.hllKeys);
    const uniqueVisitors = await mergeUniqueVisitors(hllKeys);

    return {
      total: summary.total + liveToday.total,
      uniqueVisitors,
      range: rangeKey,
      topUrl: topUrls[0] || null,
    };
  });
};


export const getOverallAnalyticsTimeseries = async (userId, range) => {
  const rangeKey = validateRange(range);
  const key = analyticsCacheKey("user", userId, rangeKey, "timeseries");
  return withCache(key, TTL.timeseries, async () => {
    const urlIds = await getUserUrlIds(userId);
    if (urlIds.length === 0) return [];

    const since = sinceDate(rangeKey);
    const [buckets, liveToday] = await Promise.all([
      getBucketsByUrls(urlIds, since),
      getLiveBucketForUrlsToday(urlIds),
    ]);

    const byDate = new Map();
    for (const bucket of buckets) {
      const entry = byDate.get(bucket.date) || {
        date: bucket.date,
        total: 0,
        hllKeys: [],
      };
      entry.total += bucket.total || 0;
      entry.hllKeys.push(hllArchiveKey(bucket.url_id, bucket.date));
      byDate.set(bucket.date, entry);
    }
    if (liveToday.total > 0 || liveToday.hllKeys.length > 0) {
      const todayEntry = byDate.get(liveToday.date) || {
        date: liveToday.date,
        total: 0,
        hllKeys: [],
      };
      todayEntry.total += liveToday.total;
      todayEntry.hllKeys.push(...liveToday.hllKeys);
      byDate.set(liveToday.date, todayEntry);
    }

    const days = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return Promise.all(
      days.map(async ({ date, total, hllKeys }) => ({
        date,
        total,
        uniqueVisitors: await mergeUniqueVisitors(hllKeys),
      })),
    );
  });
};

export const getOverallAnalyticsBreakdown = async (userId, range, by) => {
  const rangeKey = validateRange(range);
  const dimension = validateBreakdown(by);
  const key = analyticsCacheKey(
    "user",
    userId,
    rangeKey,
    `breakdown:${dimension}`,
  );
  return withCache(key, TTL.breakdown, async () => {
    const urlIds = await getUserUrlIds(userId);
    if (urlIds.length === 0) return [];

    const since = sinceDate(rangeKey);
    const buckets = await getBucketsByUrls(urlIds, since);
    const { summary } = mergeBuckets(buckets);

    return topN(summary[dimension]);
  });
};

export const getOverallAnalyticsLeaderboard = async (
  userId,
  range,
  limit = 10,
) => {
  const rangeKey = validateRange(range);
  const cappedLimit = Math.min(limit, 50);
  const key = analyticsCacheKey(
    "user",
    userId,
    rangeKey,
    `leaderboard:${cappedLimit}`,
  );
  return withCache(key, TTL.leaderboard, async () => {
    const urlIds = await getUserUrlIds(userId);
    if (urlIds.length === 0) return [];

    const since = sinceDate(rangeKey);
    return getTopUrlsForUser(urlIds, since, cappedLimit);
  });
};
