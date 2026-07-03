import mongoose from "mongoose";
import { saveClickBucket } from "../../dao/clickBucket.dao.js";
import { ShortUrlSchema } from "../../models/shortUrl.model.js";
import redis from "../../config/redis.config.js";
import { invalidateAnalyticsCache } from "../../utils/cacheKeys.js";
import {
  archiveMinuteHll,
  hllArchiveKey,
} from "../../cache/clickBucket.redis.js";

const RETENTION_DAYS = 90;
const RETENTION_SECONDS = RETENTION_DAYS * 86400;

// processingKey looks like: processing:analytics:<urlId>:<date>:<hh>:<mm>
export async function flushClaimedKey(processingKey) {
  const stripped = processingKey.replace(/^processing:/, "");
  const [, urlId, date, hh, mm] = stripped.split(":");
  const minute = `${hh}:${mm}`;

  const data = await redis.hgetall(processingKey);

  if (!data || Object.keys(data).length === 0) {
    // nothing to flush — clean up the claim and bail
    await redis.del(processingKey);
    await redis.zrem("processing:active", processingKey);
    return null;
  }

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

  await archiveMinuteHll(urlId, date, minute, RETENTION_SECONDS);
  const archiveKey = hllArchiveKey(urlId, date);
  const uniqueVisitors = (await redis.exists(archiveKey))
    ? await redis.pfcount(archiveKey)
    : 0;
  const expireAt = new Date(Date.now() + RETENTION_DAYS * 86400000);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
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
        { session },
      );

      if (totalClicks > 0) {
        await ShortUrlSchema.updateOne(
          { _id: urlId },
          { $inc: { clicks: totalClicks } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
  // if withTransaction threw, we fall out of this function via the throw below —
  // processing key and ZSET entry are deliberately left in place for retry

  await redis.del(processingKey);
  await redis.zrem("processing:active", processingKey);
  await invalidateAnalyticsCache(urlId);

  return totalClicks > 0 ? { urlId, totalClicks } : null;
}