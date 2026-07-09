import { Queue } from "bullmq";
import logger from "../logger/index.js";
import redis from "../config/redis.config.js";

export const clickQueue = new Queue("clicks", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: {
      count: 0,
    },
    removeOnFail: {
      age: 24 * 3600,
    },
  },
});

export const emailQueue = new Queue("emails", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: {
      count: 0,
    },
    removeOnFail: {
      age: 24 * 3600,
    },
  },
});
