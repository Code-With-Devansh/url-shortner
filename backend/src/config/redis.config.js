import IORedis from "ioredis";
import logger from "../logger/index.js";
const options = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  retryStrategy: (times) => {
    if (times > 10) {
      logger.fatal("[redis] max reconnection attempts reached");
      process.exit(1);
    }
    return Math.min(times * 100, 3000);
  },
  connectTimeout: 10000,
  maxRetriesPerRequest: null,
};

if (process.env.REDIS_USERNAME) {
  options.username = process.env.REDIS_USERNAME;
}

if (process.env.REDIS_PASSWORD) {
  options.password = process.env.REDIS_PASSWORD;
}
const client = new IORedis(options);

client.on("connect", () => logger.info("[redis] connected"));
client.on("reconnecting", () => logger.warn("[redis] reconnecting..."));
client.on("error", (err) => logger.error({ err }, "[redis] client error"));

export default client;
