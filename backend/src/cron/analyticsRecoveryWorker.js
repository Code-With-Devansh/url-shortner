import { flushClaimedKey } from "./jobs/flushClaimedKey.js";
import { mongoConnection } from "../config/mongo.config.js";
import redis from "../config/redis.config.js";
import logger from "../logger/index.js";
import crypto from "crypto";
import config from "../config/index.js";

const jobLogger = logger.child({
  service: "cron",
  job: "AnalyticsRecoveryWorker",
  runId: crypto.randomUUID(),
});

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const CONCURRENCY = config.analyticsRecoveryWorker.concurrency;

const start = Date.now();

try {
  await mongoConnection;

  const cutoff = Date.now() - STALE_THRESHOLD_MS;
  const staleKeys = await redis.zrangebyscore("processing:active", 0, cutoff);

  if (staleKeys.length === 0) {
    jobLogger.info("no stale processing keys, exiting");
    process.exit(0);
  }

  let recovered = 0;
  let stillFailing = 0;
  let goneAlready = 0;

  for (let i = 0; i < staleKeys.length; i += CONCURRENCY) {
    const batch = staleKeys.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (processingKey) => {
        const exists = await redis.exists(processingKey);
        if (!exists) {
          // hash is gone (already flushed and cleaned, or expired) —
          // just clear the stale ZSET pointer
          await redis.zrem("processing:active", processingKey);
          return { status: "gone" };
        }
        await flushClaimedKey(processingKey);
        return { status: "recovered" };
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.status === "gone") goneAlready++;
        else recovered++;
      } else {
        stillFailing++;
        jobLogger.error({ err: r.reason }, "recovery flush failed, left for next sweep");
      }
    }
  }

  jobLogger.info(
    { durationMs: Date.now() - start, staleCount: staleKeys.length, recovered, stillFailing, goneAlready },
    "recovery job completed",
  );
} catch (err) {
  jobLogger.error({ err, durationMs: Date.now() - start }, "recovery job failed");
  process.exitCode = 1;
} finally {
  await redis.disconnect();
  await logger.flush();
  process.exit(process.exitCode ?? 0);
}