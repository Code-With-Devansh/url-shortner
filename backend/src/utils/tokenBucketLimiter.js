// A token-bucket limiter, used specifically for the redirect hot path
// (GET /:shortId) where bursty legitimate traffic (a link going viral) is
// normal and shouldn't be punished the way a strict fixed/sliding window
// would punish it. Fixed windows cap *throughput*; a token bucket caps
// *sustained rate* while still allowing saved-up burst capacity to be
// spent quickly.
//
// Model: each key (IP) has a bucket holding up to `capacity` tokens.
// Tokens refill continuously at `refillPerSec` tokens/second. Each request
// costs 1 token. If the bucket is empty, the request is rejected.
//
// Implemented as a Lua script so the check-refill-decrement sequence is
// atomic in Redis - without this, concurrent requests from the same IP
// could race past each other and double-spend a token.
import redis from "../config/redis.config.js";
import { TooManyRequestsError } from "./appError.js";
import { ErrorCodes } from "./errorCodes.js";

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerSec = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local bucket = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(bucket[1])
local lastTs = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  lastTs = now
end

-- refill based on elapsed time since last request
local elapsed = math.max(0, now - lastTs)
tokens = math.min(capacity, tokens + (elapsed * refillPerSec))

local allowed = 0
if tokens >= 1 then
  allowed = 1
  tokens = tokens - 1
end

redis.call("HMSET", key, "tokens", tokens, "ts", now)
redis.call("EXPIRE", key, ttl)

return { allowed, tokens }
`;

/**
 * @param {object} opts
 * @param {number} opts.capacity     max burst size (tokens in a full bucket)
 * @param {number} opts.refillPerSec steady-state requests/sec allowed long-term
 * @param {string} opts.prefix       redis key prefix, namespaces this bucket from others
 */
export const tokenBucketLimiter = ({ capacity, refillPerSec, prefix }) => {
  return async (req, res, next) => {
    if (process.env.NODE_ENV === "development") return next();

    const key = `ratelimit:${prefix}:${req.ip}`;
    const now = Date.now() / 1000;
    // bucket key TTL: long enough that an idle-but-not-abusive IP doesn't
    // get its history wiped between requests, short enough to not leak
    // memory for one-off visitors. ~2x the time to fully refill is plenty.
    const ttl = Math.ceil((capacity / refillPerSec) * 2) + 60;

    try {
      const [allowed, tokensLeft] = await redis.eval(
        TOKEN_BUCKET_SCRIPT,
        1,
        key,
        capacity,
        refillPerSec,
        now,
        ttl,
      );

      res.setHeader("X-RateLimit-Limit", capacity);
      res.setHeader("X-RateLimit-Remaining", Math.floor(tokensLeft));

      if (allowed === 1) {
        return next();
      }
      return next(
        new TooManyRequestsError(
          "Too many requests to this link. Slow down.",
          ErrorCodes.RATE_LIMITED_REDIRECT,
        ),
      );
    } catch (err) {
      // fail-open: a Redis hiccup should not take down the redirect path,
      // your single highest-traffic and most business-critical route.
      // Same philosophy as the bloom filter's existing fail-open behavior.
      return next();
    }
  };
};