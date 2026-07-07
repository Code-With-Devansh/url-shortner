import mongoose from "mongoose";
import { saveClickBucket } from "../../dao/clickBucket.dao.js";
import { ShortUrlSchema } from "../../models/shortUrl.model.js";
import redis from "../../config/redis.config.js";
import logger from "../../logger/index.js";
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

  // Denormalize `user` onto the bucket so overall/leaderboard queries can
  // filter directly on { user, date } instead of resolving the user's
  // entire url_id list first (see dao/clickBucket.dao.js). This is a plain
  // read outside the transaction — it's just metadata lookup, not part of
  // the write we need atomicity on.
  const url = await ShortUrlSchema.findById(urlId, "user").lean();
  const userId = url?.user ?? null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await saveClickBucket({
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
    });

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
  // The Mongo write above already committed successfully at this point —
  // a failure here just means the cache stays stale for up to its 60s TTL,
  // not that the flush itself should be treated as failed/retried.
  await invalidateAnalyticsCache(urlId).catch((err) => {
    logger.warn({ err, urlId }, "analytics cache invalidation failed after successful flush");
  });

  return totalClicks > 0 ? { urlId, totalClicks } : null;
}