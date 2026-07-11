import ClickBucket from '../models/clickBucket.model.js';

export const saveClickBucket = async ({
  urlId,
  userId,
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
  session,
}) => {
  const inc = { total: totalClicks };
  const addDimension = (name, counts) => {
    for (const [key, count] of Object.entries(counts)) {
      inc[`${name}.${key}`] = count;
    }
  };
  addDimension("countries", countries);
  addDimension("devices", devices);
  addDimension("browsers", browsers);
  addDimension("os", os);
  addDimension("referers", referers);
  addDimension("hours", hours);

  await ClickBucket.findOneAndUpdate(
    { url_id: urlId, date },
    {
      $inc: inc,
      $set: { uniqueVisitors, expires_at: expireAt, user: userId },
    },
    { upsert: true, session },
  );
};


// All buckets for one URL, most recent first, within a date range
export const getBucketsByUrl = async (urlId, since) => {
  const today = new Date().toISOString().split("T")[0];
  return ClickBucket.find(
    { url_id: urlId, date: { $gte: since } }, 
    "-_id -__v",
  ).sort({ date: 1 }).lean();
};

// All buckets belonging to a user (used for the "overall" views) within a
// date range. Filters on the denormalized `user` field via the
// { user: 1, date: -1 } index — no url_id list needed, so this no longer
// scales with how many short URLs the user has created.
export const getBucketsByUser = async (userId, since) => {
  return ClickBucket.find(
    { user: userId, date: { $gte: since } },
    "-_id -__v",
  )
    .sort({ date: 1 })
    .lean();
};

// Top N URLs by total clicks across a date range, joined with URL metadata.
// Matches on `user` directly (index-backed) and truncates with $limit
// BEFORE the $lookup, so the join only ever runs against the handful of
// URLs actually being returned, not the user's entire link history.
export const getTopUrlsForUser = async (userId, since, limit) => {
  return ClickBucket.aggregate([
    { $match: { user: userId, date: { $gte: since } } },
    {
      $group: {
        _id: "$url_id",
        clicks: { $sum: "$total" },
      },
    },
    { $sort: { clicks: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "shorturls",
        localField: "_id",
        foreignField: "_id",
        as: "url",
      },
    },
    { $unwind: "$url" },
    {
      $project: {
        _id: 0,
        urlId: "$_id",
        shortUrl: "$url.short_url",
        fullUrl: "$url.full_url",
        clicks: 1,
      },
    },
  ]);
};