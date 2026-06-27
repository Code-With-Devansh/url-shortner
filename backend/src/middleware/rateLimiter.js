import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redis from "../config/redis.config.js";
import { ipKeyGenerator } from "express-rate-limit";
import { ErrorCodes } from "../utils/errorCodes.js";
const skipInDev = () => process.env.NODE_ENV === "development";
const createStore = (prefix) =>
  new RedisStore({
    prefix,
    sendCommand: async (...args) => {
      return redis.call(...args);
    },
  });

const commonConfig = {
  standardHeaders: true,
  legacyHeaders: false,
    skip: skipInDev

};

// --- Login: keyed by IP + email together ---
// IP-only lets an attacker spread credential stuffing across many target
// emails from one IP and only ever trip the limit once per target.
// Email-only lets a botnet rotate IPs and never trip it at all. Combining
// the two catches both shapes of attack while one legitimate user
// mistyping their password a few times from one IP barely moves the needle.
export const loginLimiter = rateLimit({
  ...commonConfig,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMITED_LOGIN,
    message: "Too many login attempts. Try again later.",
  },
  windowMs: 15 * 60 * 1000,
  max: 10,
  store: createStore("login"),
  keyGenerator: (req) => {
    const email = (req.body?.email || "unknown").toLowerCase().trim();
    return `${ipKeyGenerator(req)}:${email}`;
  },
});

export const registerLimiter = rateLimit({
  ...commonConfig,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMITED_REGISTER,
    message: "Too many registration attempts. Try again later.",
  },
  windowMs: 60 * 60 * 1000,
  max: 5,
  store: createStore("register"),
});

// --- Shorten: split anonymous vs authenticated ---
// Anonymous link creation is the classic spam/phishing-link vector (your
// service becoming a free disposable redirect generator), so it gets a
// noticeably tighter cap than authenticated usage, which is normal
// product usage by someone with a verified account on the hook.
//
// IMPORTANT: this must run AFTER `attachUser` in the route definition, or
// req.user is never populated yet and every request silently falls back
// to the anonymous limiter regardless of auth state.
export const shortenLimiterAuthenticated = rateLimit({
  ...commonConfig,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMITED_SHORTEN,
    message: "Too many URLs created. Try again in a bit.",
  },
  windowMs: 1 * 60 * 1000,
  max: 10,
  store: createStore("shorten:auth"),
  keyGenerator: (req) => req.user.id,
  skip: (req) => skipInDev() || !req.user,
});

export const shortenLimiterAnonymous = rateLimit({
  ...commonConfig,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMITED_SHORTEN,
    message: "Too many URLs created, try again later or sign in for a higher limit.",
  },
  windowMs: 1 * 60 * 1000,
  max: 5,
  store: createStore("shorten:anon"),
  skip: (req) => skipInDev() || !!req.user,
});

// --- Email-sending endpoints: keyed by the target email, not the IP ---
// Without this, anyone can email-bomb a victim by repeatedly requesting
// password resets / verification links for an address they don't own.
// IP-keying alone wouldn't stop that (attacker's IP isn't the victim's).
export const emailLimiter = rateLimit({
  ...commonConfig,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMITED_EMAIL,
    message: "Too many requests for this email address. Try again later.",
  },
  windowMs: 60 * 60 * 1000,
  max: 4,
  store: createStore("email"),
  keyGenerator: (req) => {
    const email = (req.body?.email || ipKeyGenerator(req)).toLowerCase().trim();
    return email;
  },
});

// --- Refresh: keyed by IP + deviceId ---
// Each call does multiple Redis ops plus a Mongo write. A refresh-token-
// reuse-detection loop or a buggy frontend retry storm can hammer this far
// harder than `login` itself, so it gets its own backstop even though it's
// not adversarial in the typical case.
export const refreshLimiter = rateLimit({
  ...commonConfig,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMITED_REFRESH,
    message: "Too many refresh attempts. Please log in again.",
  },
  windowMs: 5 * 60 * 1000,
  max: 20,
  store: createStore("refresh"),
  keyGenerator: (req) => {
    const deviceId = req.cookies?.deviceId || "unknown-device";
    return `${ipKeyGenerator(req)}:${deviceId}`;
  },
});

// --- Generic backstop for authenticated routes (analytics, user urls) ---
// Low abuse risk since these require a valid access token, but still worth
// a backstop against a buggy frontend retry loop or a scraping script
// using a leaked token, rather than leaving these completely unguarded.
export const authenticatedApiLimiter = rateLimit({
  ...commonConfig,
  message: {
    success: false,
    code: ErrorCodes.RATE_LIMITED_API,
    message: "Too many requests. Please slow down.",
  },
  windowMs: 1 * 60 * 1000,
  max: 100,
  store: createStore("api"),
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
});