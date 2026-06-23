import { Worker } from "bullmq";
import redis from "../config/redis.config.js";
import logger from "../logger/index.js";
import { sendEmail } from "./jobs/sendEmail.js";

const worker = new Worker(
  "emails",
  async (job) => {
    await sendEmail(job.data);
    logger.debug({ jobId: job.id }, "Email send job completed");
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  },
);


worker.on("failed", (job, err) => {
  logger.error(`Click job ${job.id} failed:`, err.message);
});