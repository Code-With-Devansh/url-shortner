import { ShortUrlSchema } from "../models/shortUrl.model.js";
import ClickBucket from '../models/clickBucket.model.js';

export const saveClickBucket = async (
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
) => {
  await ClickBucket.findOneAndUpdate(
    { url_id: urlId, date },
    {
      $set: {
        total: totalClicks,
        uniqueVisitors,
        countries,
        devices,
        browsers,
        os,
        referers,
        hours,
        expires_at: expireAt,
      },
    },
    { upsert: true },
  );
};


// All buckets for one URL, most recent first, within a date range
export const getBucketsByUrl = async (urlId, since) => {
  const today = new Date().toISOString().split("T")[0];
  return ClickBucket.find(
    { url_id: urlId, date: { $gte: since, $lt: today } }, 
    "-_id -__v",
  ).sort({ date: 1 }).lean();
};

// All buckets for many URLs (used for the "overall" views) within a date range
export const getBucketsByUrls = async (urlIds, since) => {
  return ClickBucket.find(
    { url_id: { $in: urlIds }, date: { $gte: since } },
    "-_id -__v",
  )
    .sort({ date: 1 })
    .lean();
};

// Just the ids — used to scope overall queries to "this user's URLs"
export const getUserUrlIds = async (userId) => {
  const urls = await ShortUrlSchema.find({ user: userId }, "_id").lean();
  return urls.map((u) => u._id);
};

// Top N URLs by total clicks across a date range, joined with URL metadata
export const getTopUrlsForUser = async (urlIds, since, limit) => {
  return ClickBucket.aggregate([
    { $match: { url_id: { $in: urlIds }, date: { $gte: since } } },
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