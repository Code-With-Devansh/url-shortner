import {
  getBucketsByUrl,
  getBucketsByUrls,
  getUserUrlIds,
  getTopUrlsForUser,
} from "../dao/clickBucket.dao.js";
import { findShortUrlByIdForUser } from "../dao/shortUrl.js";
import { NotFoundError, ValidationError } from "../utils/appError.js";
 


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
    summary.uniqueVisitors += bucket.uniqueVisitors || 0;

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
      `range must be one of: ${Object.keys(ALLOWED_RANGES).join(", ")}`,
    );
  }
  return range || "30d";
};


const validateBreakdown = (by) => {
  if (!ALLOWED_BREAKDOWNS.includes(by)) {
    throw new ValidationError(
      `by must be one of: ${ALLOWED_BREAKDOWNS.join(", ")}`,
    );
  }
  return by;
};

// per url
export const getUrlAnalyticsSummary = async (urlId, userId, range) => {
  const url = await findShortUrlByIdForUser(urlId, userId); 
  if (!url) throw new NotFoundError("Short URL not found");
 
  const since = sinceDate(validateRange(range));
  const buckets = await getBucketsByUrl(urlId, since);
  const { summary } = mergeBuckets(buckets);
 
  return {
    urlId,
    shortUrl: url.short_url,
    fullUrl: url.full_url,
    range: range || "30d",
    total: summary.total,
    uniqueVisitors: summary.uniqueVisitors,
  };
};

export const getUrlAnalyticsTimeseries = async (urlId, userId, range) => {
  const url = await findShortUrlByIdForUser(urlId, userId);
  if (!url) throw new NotFoundError("Short URL not found");
 
  const since = sinceDate(validateRange(range));
  const buckets = await getBucketsByUrl(urlId, since);
  const { timeseries } = mergeBuckets(buckets);
 
  return timeseries;
};

export const getUrlAnalyticsBreakdown = async (urlId, userId, range, by) => {
  const url = await findShortUrlByIdForUser(urlId, userId);
  if (!url) throw new NotFoundError("Short URL not found");
 
  const dimension = validateBreakdown(by);
  const since = sinceDate(validateRange(range));
  const buckets = await getBucketsByUrl(urlId, since);
  const { summary } = mergeBuckets(buckets);
 
  return topN(summary[dimension]);
};
 


// overall

export const getOverallAnalyticsSummary = async (userId, range) => {
  const urlIds = await getUserUrlIds(userId);
  if (urlIds.length === 0) {
    return { total: 0, uniqueVisitors: 0, range: range || "30d", topUrl: null };
  }
 
  const since = sinceDate(validateRange(range));
  const [buckets, topUrls] = await Promise.all([
    getBucketsByUrls(urlIds, since),
    getTopUrlsForUser(urlIds, since, 1),
  ]);
  const { summary } = mergeBuckets(buckets);
 
  return {
    total: summary.total,
    uniqueVisitors: summary.uniqueVisitors,
    range: range || "30d",
    topUrl: topUrls[0] || null,
  };
};

export const getOverallAnalyticsTimeseries = async (userId, range) => {
  const urlIds = await getUserUrlIds(userId);
  if (urlIds.length === 0) return [];
 
  const since = sinceDate(validateRange(range));
  const buckets = await getBucketsByUrls(urlIds, since);
 
  // Overall timeseries needs to merge multiple URLs' buckets sharing the
  // same date into a single point per day — mergeBuckets() above produces
  // one entry per bucket doc, which is correct for per-URL (1 bucket/day)
  // but wrong here (N buckets/day, one per URL). Re-group by date:
  const byDate = new Map();
  for (const bucket of buckets) {
    const entry = byDate.get(bucket.date) || { date: bucket.date, total: 0, uniqueVisitors: 0 };
    entry.total += bucket.total || 0;
    entry.uniqueVisitors += bucket.uniqueVisitors || 0; // upper bound, see caveat
    byDate.set(bucket.date, entry);
  }
 
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
};

export const getOverallAnalyticsBreakdown = async (userId, range, by) => {
  const dimension = validateBreakdown(by);
  const urlIds = await getUserUrlIds(userId);
  if (urlIds.length === 0) return [];
 
  const since = sinceDate(validateRange(range));
  const buckets = await getBucketsByUrls(urlIds, since);
  const { summary } = mergeBuckets(buckets);
 
  return topN(summary[dimension]);
};

export const getOverallAnalyticsLeaderboard = async (userId, range, limit = 10) => {
  const urlIds = await getUserUrlIds(userId);
  if (urlIds.length === 0) return [];
 
  const since = sinceDate(validateRange(range));
  return getTopUrlsForUser(urlIds, since, Math.min(limit, 50));
};