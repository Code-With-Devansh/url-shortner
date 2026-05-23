import { createClient } from "redis";
import logger from "../logger/index.js";
const client = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.fatal('[redis] max reconnection attempts reached');
        process.exit(1);
      }
      return Math.min(retries * 100, 3000)
    },
    connectTimeout: 10_000,
  },
});


client.on('connect',   () => logger.info('[redis] connected'));
client.on('reconnecting', () => logger.warn('[redis] reconnecting...'));
client.on('error',     (err) => logger.error({ err }, '[redis] client error'));

export const redisConnection = client.connect();
export default client;