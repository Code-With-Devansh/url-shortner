import { mongoConnection } from "../config/mongo.config.js";
import { redisConnection } from "../config/redis.config.js";
import { reserveBloom } from "../dao/redirectBloom.redis.js";
import { ShortUrlSchema } from "../models/shortUrl.model.js";
import redis from "../config/redis.config.js";
import logger from "../logger/productionLogger.js";
import crypto from "crypto";

const scriptLogger = logger.child({
  service: "script",
  job: "RebuildBloom",
  runId: crypto.randomUUID(),
});

export async function rebuildBloom() {
  await reserveBloom();
  const cursor = ShortUrlSchema.find({}, "short_url").cursor();
  let batch = [];
  for await (const url of cursor) {
    batch.push(url.short_url);
    if (batch.length === 1000) {
      await redis.sendCommand(["BF.MADD", "urls:bloom", ...batch]);
      batch = [];
    }
  }
  if (batch.length > 0) {
    await redis.sendCommand(["BF.MADD", "urls:bloom", ...batch]);
  }
}
const start = Date.now();
try {
  await Promise.all([redisConnection, mongoConnection]);
  await rebuildBloom();
  scriptLogger.info(
    { durationMs: Date.now() - start },
    "Loaded all the urls to bloom filter",
  );
} catch (err) {
  scriptLogger.error(
    { err, durationMs: Date.now() - start },
    "Loaded all the urls to bloom filter. job failed",
  );
  process.exitCode = 1;
} finally {
  await redis.quit();
  await logger.flush();
  process.exit(process.exitCode ?? 0);
}
