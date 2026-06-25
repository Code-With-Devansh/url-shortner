import { Queue } from "bullmq";
import logger from "../logger/index.js";
import bullmqClient from "../config/bullmq.config.js";

export const clickQueue = new Queue("clicks", {
  connection: bullmqClient,
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
  connection: bullmqClient,
  defaultJobOptions: {
    removeOnComplete: {
      count: 0,
    },
    removeOnFail: {
      age: 24 * 3600,
    },
  },
});
