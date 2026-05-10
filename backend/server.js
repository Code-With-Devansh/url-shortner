import "dotenv/config";
import mongoose from "mongoose";
import { connectRedis } from "./src/config/redis.config.js";

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    await connectRedis();
    console.log("Redis connected successfully");

    const { default: app } = await import("./app.js");

    app.listen(process.env.PORT || 5000, () => {
      console.log("Server running on port 5000");
    });

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

startServer();