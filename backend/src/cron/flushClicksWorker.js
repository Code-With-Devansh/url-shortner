import "dotenv/config";
import crypto from "crypto";
import redis from "../config/redis.config.js";
import logger from "../logger/index.js";
import { flushClicksToDB } from "./jobs/flushClicks.js";
import { mongoConnection } from "../config/mongo.config.js";

const jobLogger = logger.child({
  service: "cron",
  job: "flushClicks",
  runId: crypto.randomUUID(),
});

const start = Date.now();

try {
  await mongoConnection;
  await flushClicksToDB();
  jobLogger.info({ durationMs: Date.now() - start }, "job completed");
} catch (err) {
  jobLogger.error({ err, durationMs: Date.now() - start }, "job failed");
  process.exitCode = 1;
} finally {
  await redis.quit();
  await logger.flush();
  process.exit(process.exitCode ?? 0);
}
