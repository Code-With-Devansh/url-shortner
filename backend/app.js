import express from "express";
import cors from "cors";
import shortUrlRoute from "./src/routes/shortUrl.route.js";
import authRoute from "./src/routes/auth.route.js";
import { redirectFromShortUrl } from "./src/controller/shortUrl.controller.js";
import { errorHandler } from "./src/utils/errorHandler.js";
import { attachUser } from "./src/middleware/attachUser.js";
import userRoute from "./src/routes/user.route.js";
import cookieParser from "cookie-parser";
import { requestLogger } from "./src/middleware/requestLogger.js";
import { isShuttingDown } from "./state/shutdown.js";
import helmet from "helmet";
import analyticsRoute from "./src/routes/analytics.route.js";
import {tokenBucketLimiter} from "./src/utils/tokenBucketLimiter.js";
import { concurrencyLimiter, getInFlightCount } from "./src/middleware/concurrencyLimiter.js";
// capacity = burst size, refillPerSec = sustained steady-state rate.
// These are starting points sized generously above a guessed legitimate
// peak (a single real visitor rarely re-clicks a link more than once or
// twice a second) - tune from observed traffic, not from this number alone.
const redirectLimiter = tokenBucketLimiter({
  capacity: 30,
  refillPerSec: 5,
  prefix: "redirect",
});
const globalConcurrencyLimiter = concurrencyLimiter({ maxConcurrent: 500 });

const app = express();
app.use(
  cors({
    origin: process.env.APP_URL_CORS,
    credentials: true,
  }),
);
app.use(requestLogger);
app.use(globalConcurrencyLimiter);
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/static", express.static("public"));

app.use((req, res, next) => {
  if (isShuttingDown()) {
    return res.status(503).json({
      success: false,
      message: "Server shutting down",
    });
  }
  next();
});
app.use("/api", shortUrlRoute);
app.use("/api/analytics", analyticsRoute);
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.get("/api/health", (req, res) => {
  if (isShuttingDown()) {
    return res.status(503).json({
      success: false,
      status: "shutting_down",
    });
  }
  return res.json({
    success: true,
    inFlight: getInFlightCount(),
  });
});
app.get("/:shortId", redirectLimiter, redirectFromShortUrl);
app.use(errorHandler);

export default app;
