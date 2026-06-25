import { Worker } from "bullmq";
import redis from "../config/redis.config.js";
import { processClick } from "./jobs/processClick.js";
import logger from "../logger/index.js";

const worker = new Worker(
  "clicks",
  async (job) => {
    await processClick(job.data);
    logger.debug({ jobId: job.id }, "Analytics job completed");
  },
  { connection: redis, concurrency: 10}
);

worker.on("failed", (job, err) => {
  logger.error(`Click job ${job.id} failed:`, err.message);
});