import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redis from "../config/redis.config.js";
import { ipKeyGenerator } from "express-rate-limit";
const createStore = (prefix) =>
  new RedisStore({
    prefix,
    sendCommand: (...args) => redis.sendCommand(args),
  });

const commonConfig = {
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Try again later.",
  },


};

export const loginLimiter = rateLimit({
  ...commonConfig,

  windowMs: 15 * 60 * 1000,
  max: 10,
    store:createStore('login'),
});

export const registerLimiter = rateLimit({
  ...commonConfig,

  windowMs: 60 * 60 * 1000,
  max: 5,
    store:createStore('register'),
});

export const shortenLimiter = rateLimit({
  ...commonConfig,

  windowMs: 1 * 60 * 1000,
  max: 20,
    store:createStore('shorten'),

  keyGenerator: (req) => {
    return req.user?.id || ipKeyGenerator(req);
  },
});