import { flushAnalyticsKey } from "./jobs/flushAnalytics.js";
import { ShortUrlSchema } from "../models/shortUrl.model.js";
import redis from "../config/redis.config.js";
import { mongoConnection } from "../config/mongo.config.js";
import logger from "../logger/index.js";
import crypto from 'crypto'
const jobLogger = logger.child({
  service: "cron",
  job: "AnalyticsWorker",
  runId: crypto.randomUUID(),
});

const start = Date.now();

try {
  await mongoConnection;

  const keys = await redis.smembers("analytics:active");

  if (keys.length === 0) {
    jobLogger.info("no keys to flush, exiting");
    process.exit(0);
  }

  const CONCURRENCY = 10;
   let totalClickUpdates = 0;
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(flushAnalyticsKey));
    const clicksByUrl = new Map();
    for (const result of results) {
      if (!result) continue;
      const { urlId, totalClicks } = result;
      clicksByUrl.set(urlId, (clicksByUrl.get(urlId) ?? 0) + totalClicks);
    }

    if (clicksByUrl.size > 0) {
      const operations = Array.from(clicksByUrl, ([urlId, count]) => ({
        updateOne: {
          filter: { _id: urlId },
          update: { $inc: { clicks: count } },
        },
      }));
      await ShortUrlSchema.bulkWrite(operations);
      totalClickUpdates += operations.length;
    }
  }

  jobLogger.info(
    { durationMs: Date.now() - start, keyCount: keys.length, totalClickUpdates  },
    "job completed"
  );
} catch (err) {
  jobLogger.error({ err, durationMs: Date.now() - start }, "job failed");
  process.exitCode = 1;
} finally {
  await redis.disconnect();
  await logger.flush();
  process.exit(process.exitCode ?? 0);
}