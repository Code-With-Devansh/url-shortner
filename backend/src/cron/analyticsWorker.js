import { flushAnalyticsKey } from "./jobs/flushAnalytics.js";
import { mongoConnection } from "../config/mongo.config.js";
import redis from "../config/redis.config.js";
import logger from "../logger/index.js";
import crypto from "crypto";
import { ANALYTICS_DUE_ZSET } from "../cache/clickBucket.redis.js";

const jobLogger = logger.child({
  service: "cron",
  job: "AnalyticsWorker",
  runId: crypto.randomUUID(),
});

const start = Date.now();
const GRACE_MS = 10_000;

try {
  await mongoConnection;
  const keys = await redis.zrangebyscore(ANALYTICS_DUE_ZSET, "-inf", Date.now() - GRACE_MS);

  if (keys.length === 0) {
    jobLogger.info("no keys to flush, exiting");
    process.exit(0);
  }

  const CONCURRENCY = 10;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(flushAnalyticsKey));

    for (const r of results) {
      if (r.status === "fulfilled") succeeded++;
      else {
        failed++;
        jobLogger.error({ err: r.reason }, "flush failed for key, left claimed for retry");
      }
    }
  }

  jobLogger.info(
    { durationMs: Date.now() - start, keyCount: keys.length, succeeded, failed },
    "job completed",
  );
} catch (err) {
  jobLogger.error({ err, durationMs: Date.now() - start }, "job failed");
  process.exitCode = 1;
} finally {
  await redis.disconnect();
  await logger.flush();
  process.exit(process.exitCode ?? 0);
}