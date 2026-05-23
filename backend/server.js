import "dotenv/config";
import mongoose from "mongoose";
import { redisConnection } from "./src/config/redis.config.js";
import logger from "./src/logger/index.js";
import { mongoConnection } from "./src/config/mongo.config.js";

async function startServer() {
  try {
    await Promise.all([redisConnection, mongoConnection]);

    const { default: app } = await import("./app.js");
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      logger.info({ port: PORT }, "Server started");
    });

  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}
startServer();