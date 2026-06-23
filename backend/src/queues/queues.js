import { Queue } from "bullmq";
import logger from "../logger/index.js";
import bullmqClient from "../config/bullmq.config.js";

export const clickQueue = new Queue("clicks", {
  connection: bullmqClient,
});

export const emailQueue = new Queue("emails", {
  connection: bullmqClient,
  defaultJobOptions:{
    removeOnComplete: true,
    removeOnFail: {
      age: 24 * 3600,
    },
  }
});
