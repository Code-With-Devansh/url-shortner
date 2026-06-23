import { flushAnalyticsKey } from "./jobs/flushAnalytics.js";
import redis from "../config/redis.config.js";
import { mongoConnection } from "../config/mongo.config.js";
import logger from "../logger/index.js";

const jobLogger = logger.child({
  service: "cron",
  job: "AnalyticsWorker",
  runId: crypto.randomUUID(),
});

const start = Date.now();

try {
  await mongoConnection;

  const keys = await redis.sMembers("analytics:active");


  if (keys.length === 0) {
    jobLogger.info("no keys to flush, exiting");
    process.exit(0);
  }
  const CONCURRENCY = 10;
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(flushAnalyticsKey));
  }

  jobLogger.info(
    { durationMs: Date.now() - start, keyCount: keys.length },
    "job completed"
  );
} catch (err) {
  jobLogger.error({ err, durationMs: Date.now() - start }, "job failed");
  process.exitCode = 1;
} finally {
  await redis.quit();
  await logger.flush();
  process.exit(process.exitCode ?? 0);
}