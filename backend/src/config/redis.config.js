import { createClient } from "redis";
import logger from "../logger/index.js";
const client = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: 14561,
    reconnectStrategy: (retries) => {
      return Math.min(retries * 50, 500);
    },
  },
});


client.on("error", (err) => {
  logger.error({ err }, "Redis client error");
});

export const connectRedis = async () => {
  await client.connect();
  logger.info("Redis connected");
};

export default client;