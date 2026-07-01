import IORedis from "ioredis";
import logger from "../logger/index.js";
import config from "./index.js";

const bullmqClient = new IORedis({
  host:config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  username: "default",
  retryStrategy: (times) => {
    if (times > 10) {
      logger.fatal('[redis] max reconnection attempts reached');
      process.exit(1);
    }
    return Math.min(times * 100, 3000);
  },
  connectTimeout: 10_000,
  maxRetriesPerRequest: null,
});

bullmqClient.on('connect', () => logger.info('[bullmqClient] connected'));
bullmqClient.on('reconnecting', () => logger.warn('[bullmqClient] reconnecting...'));
bullmqClient.on('error', (err) => logger.error({ err }, '[bullmqClient] client error'));

export default bullmqClient;