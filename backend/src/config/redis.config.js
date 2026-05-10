import { createClient } from "redis";
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
  console.error("Redis Error:", err);
});

export const connectRedis = async () => {
  await client.connect();
  console.log("Redis Connected");
};

export default client;