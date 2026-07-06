import { clickQueue } from "../queues/queues.js";
import {
  getBucketsByUrl,
  getBucketsByUser,
  getUserUrlIds,
  getTopUrlsForUser,
  getAllUrlTotalsForUser,
} from "../dao/clickBucket.dao.js";

import redis from "../config/redis.config.js";
import { ErrorCodes } from "../utils/errorCodes.js";
import { safeIp } from "../utils/safeIp.js";

import { findShortUrlByIdForUser, getShortUrlsMetaByIds } from "../dao/shortUrl.js";
import { NotFoundError, ValidationError } from "../utils/appError.js";
import { analyticsCacheKey } from "../utils/cacheKeys.js";
import { withCache } from "../utils/withCache.js";
import {getActiveBucketKeysForDate, getActiveBucketKeysForUrls, getLiveTotalsByUrl, hllArchiveKey, hllKeyForBucket, mergeUniqueVisitors} from '../cache/clickBucket.redis.js'

const CACHE_TTL = {
  historical: 60, // Mongo only changes once per flush cycle (every minute)
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
const getCachedBucketsByUrl = (urlId, since, rangeKey) => {
  const key = analyticsCacheKey("url", urlId, rangeKey, "mongo-buckets");
  return withCache(key, CACHE_TTL.historical, () => getBucketsByUrl(urlId, since));
};

// Keyed by userId directly now (not a joined list of url_ids) — the query
// itself filters on the denormalized `user` field on ClickBucket, so there's
// no need to resolve/serialize the user's url_id list just to build a cache
// key or scope the query.
const getCachedBucketsByUser = (userId, since, rangeKey) => {
  const key = analyticsCacheKey("user", userId, rangeKey, "mongo-buckets");
  return withCache(key, CACHE_TTL.historical, () => getBucketsByUser(userId, since));
};

const getCachedTopUrls = (userId, since, rangeKey, limit) => {
  const key = analyticsCacheKey("user", userId, rangeKey, `top-urls:${limit}`);
  return withCache(key, CACHE_TTL.historical, () => getTopUrlsForUser(userId, since, limit));
};

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
    ip: safeIp(req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip),
    userAgent: req.headers["user-agent"],
    referer,
    timestamp: Date.now(),
  });
}


async function aggregateBucketKeys(keys) {
  const countries = {};
  const devices = {};
  const browsers = {};
  const os = {};
  const referers = {};
  const hours = {};
  let total = 0;
  const hllKeys = [];

  if (keys.length === 0) {
    return { total, countries, devices, browsers, os, referers, hours, hllKeys };
  }

  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.hgetall(key);
  }
  const results = await pipeline.exec();

  for (let i = 0; i < keys.length; i++) {
    const [err, data] = results[i];
    if (err) {
      // Don't let one bad bucket kill the whole aggregation
      continue;
    }

    for (const [field, value] of Object.entries(data || {})) {
      const count = Number(value);
      if (field === "total") total += count;
      else if (field.startsWith("country:")) countries[field.slice(8)] = (countries[field.slice(8)] || 0) + count;
      else if (field.startsWith("device:")) devices[field.slice(7)] = (devices[field.slice(7)] || 0) + count;
      else if (field.startsWith("browser:")) browsers[field.slice(8)] = (browsers[field.slice(8)] || 0) + count;
      else if (field.startsWith("os:")) os[field.slice(3)] = (os[field.slice(3)] || 0) + count;
      else if (field.startsWith("referer:")) referers[field.slice(8)] = (referers[field.slice(8)] || 0) + count;
      else if (field.startsWith("hour:")) hours[field.slice(5)] = (hours[field.slice(5)] || 0) + count;
    }

    hllKeys.push(hllKeyForBucket(keys[i]));
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
  const since = sinceDate(rangeKey);

  const [mongoBuckets, todayBucket] = await Promise.all([
    getCachedBucketsByUrl(urlId, since, rangeKey),
    getLiveBucketForToday(urlId), // always fresh, never cached
  ]);
  const allBuckets = todayBucket ? [...mongoBuckets, todayBucket] : mongoBuckets;
  const { summary } = mergeBuckets(allBuckets);

  const hllKeys = mongoBuckets.map((b) => hllArchiveKey(urlId, b.date));
  if (todayBucket) hllKeys.push(...todayBucket.hllKeys);
  const uniqueVisitors = await mergeUniqueVisitors(hllKeys);

  return {
    urlId,
    shortUrl: url.short_url,
    fullUrl: url.full_url,
    range: rangeKey,
    total: summary.total,
    uniqueVisitors,
  };
};

export const getUrlAnalyticsTimeseries = async (urlId, userId, range) => {
  const url = await findShortUrlByIdForUser(urlId, userId);
  if (!url) throw new NotFoundError("Short URL not found", ErrorCodes.URL_NOT_FOUND);

  const rangeKey = validateRange(range);
  const since = sinceDate(rangeKey);

  const [mongoBuckets, todayBucket] = await Promise.all([
    getCachedBucketsByUrl(urlId, since, rangeKey),
    getLiveBucketForToday(urlId),
  ]);
  const allBuckets = todayBucket ? [...mongoBuckets, todayBucket] : mongoBuckets;
  const { timeseries } = mergeBuckets(allBuckets);

  if (todayBucket) {
    const todayEntry = timeseries.find((t) => t.date === todayBucket.date);
    if (todayEntry) {
      todayEntry.uniqueVisitors = await mergeUniqueVisitors(todayBucket.hllKeys);
    }
  }

  return timeseries;
};

export const getUrlAnalyticsBreakdown = async (urlId, userId, range, by) => {
  const url = await findShortUrlByIdForUser(urlId, userId);
  if (!url) throw new NotFoundError("Short URL not found", ErrorCodes.URL_NOT_FOUND);

  const rangeKey = validateRange(range);
  const dimension = validateBreakdown(by);
  const since = sinceDate(rangeKey);

  const [mongoBuckets, todayBucket] = await Promise.all([
    getCachedBucketsByUrl(urlId, since, rangeKey),
    getLiveBucketForToday(urlId),
  ]);
  const allBuckets = todayBucket ? [...mongoBuckets, todayBucket] : mongoBuckets;
  const { summary } = mergeBuckets(allBuckets);

  return topN(summary[dimension]);
};

// overall
export const getOverallAnalyticsSummary = async (userId, range) => {
  const rangeKey = validateRange(range);
  // Still needed for the Redis-side "live today" lookup below — those
  // buckets are keyed by url_id, not by user. NOT used to scope the Mongo
  // queries anymore (those filter on `user` directly).
  const urlIds = await getUserUrlIds(userId);
  if (urlIds.length === 0) {
    return { total: 0, uniqueVisitors: 0, range: rangeKey, topUrl: null };
  }

  const since = sinceDate(rangeKey);
  const [mongoBuckets, topUrls, liveToday] = await Promise.all([
    getCachedBucketsByUser(userId, since, rangeKey),
    getCachedTopUrls(userId, since, rangeKey, 1),
    getLiveBucketForUrlsToday(urlIds),
  ]);
  const { summary } = mergeBuckets(mongoBuckets);

  const hllKeys = mongoBuckets
    .map((b) => hllArchiveKey(b.url_id, b.date))
    .concat(liveToday.hllKeys);
  const uniqueVisitors = await mergeUniqueVisitors(hllKeys);

  return {
    total: summary.total + liveToday.total,
    uniqueVisitors,
    range: rangeKey,
    topUrl: topUrls[0] || null,
  };
};


export const getOverallAnalyticsTimeseries = async (userId, range) => {
  const rangeKey = validateRange(range);
  const urlIds = await getUserUrlIds(userId); // Redis live-lookup only, see above
  if (urlIds.length === 0) return [];

  const since = sinceDate(rangeKey);
  const [mongoBuckets, liveToday] = await Promise.all([
    getCachedBucketsByUser(userId, since, rangeKey),
    getLiveBucketForUrlsToday(urlIds),
  ]);

  const byDate = new Map();
  for (const bucket of mongoBuckets) {
    const entry = byDate.get(bucket.date) || { date: bucket.date, total: 0, hllKeys: [] };
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

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return Promise.all(
    days.map(async ({ date, total, hllKeys }) => ({
      date,
      total,
      uniqueVisitors: await mergeUniqueVisitors(hllKeys),
    })),
  );
};


export const getOverallAnalyticsBreakdown = async (userId, range, by) => {
  const rangeKey = validateRange(range);
  const dimension = validateBreakdown(by);
  const urlIds = await getUserUrlIds(userId); // Redis live-lookup only, see above
  if (urlIds.length === 0) return [];

  const since = sinceDate(rangeKey);
  const [mongoBuckets, liveToday] = await Promise.all([
    getCachedBucketsByUser(userId, since, rangeKey),
    getLiveBucketForUrlsToday(urlIds),
  ]);
  const allBuckets =
    liveToday.total > 0 || liveToday.hllKeys.length > 0
      ? [...mongoBuckets, liveToday]
      : mongoBuckets;
  const { summary } = mergeBuckets(allBuckets);

  return topN(summary[dimension]);
};
export const getOverallAnalyticsLeaderboard = async (userId, range, limit = 10) => {
  const rangeKey = validateRange(range);
  const cappedLimit = Math.min(limit, 50);
  // Still needed for the Redis-side "live today" lookup — those buckets are
  // keyed by url_id, not by user. This set is naturally small in practice
  // (only URLs with clicks *today*), unlike the old getUserUrlsMeta(userId)
  // call this replaces below, which pulled the user's ENTIRE url list.
  const urlIds = await getUserUrlIds(userId);
  if (urlIds.length === 0) return [];

  const since = sinceDate(rangeKey);
  const today = new Date().toISOString().split("T")[0];
  const key = analyticsCacheKey("user", userId, rangeKey, `leaderboard-base:${cappedLimit}`);

  // getAllUrlTotalsForUser is kept around (unbounded, ranked-but-untruncated)
  // for callers that genuinely need every URL's historical total. For the
  // leaderboard specifically, getTopUrlsForUser already ranks AND truncates
  // to cappedLimit inside Mongo (before the $lookup), so we never join
  // against more than `cappedLimit` documents no matter how many short URLs
  // this user has ever created.
  const [mongoTop, liveTotals] = await Promise.all([
    withCache(key, CACHE_TTL.historical, () => getTopUrlsForUser(userId, since, cappedLimit)),
    getLiveTotalsByUrl(urlIds, today), // uncached, always fresh
  ]);

  const byUrlId = new Map(
    mongoTop.map((u) => [String(u.urlId), { ...u, clicks: u.clicks }]),
  );

  // A URL that's spiking live today but wasn't already in the top
  // `cappedLimit` historically won't have metadata yet — fetch it only for
  // that (small, "active today") set, instead of the user's whole url list.
  const missingIds = Object.keys(liveTotals).filter((id) => !byUrlId.has(id));
  if (missingIds.length > 0) {
    const meta = await getShortUrlsMetaByIds(missingIds);
    for (const u of meta) {
      byUrlId.set(String(u._id), {
        urlId: u._id,
        shortUrl: u.short_url,
        fullUrl: u.full_url,
        clicks: 0,
      });
    }
  }

  for (const [urlId, liveClicks] of Object.entries(liveTotals)) {
    const entry = byUrlId.get(urlId);
    if (entry) entry.clicks += liveClicks;
  }

  // Re-sort after merging live totals in: a URL just outside the Mongo-side
  // top `cappedLimit` could still be pushed up by today's live clicks, and
  // one already in mongoTop could (rarely) be overtaken. Truncate again to
  // cappedLimit for the final response.
  return [...byUrlId.values()]
    .filter((u) => u.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, cappedLimit);
};