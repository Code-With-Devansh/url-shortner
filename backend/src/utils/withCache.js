import redis from "../config/redis.config.js";

const DEFAULT_TTL = 120; // 2 min — analytics doesn't need to be second-fresh

export async function withCache(key, ttlSeconds, fn) {
  const cached = await redis.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // corrupted cache entry — fall through to recompute
    }
  }

  const fresh = await fn();

  // Fire-and-forget the cache write — don't make the response wait on it
  if (fresh !== undefined && fresh !== null) {
    redis.set(key, JSON.stringify(fresh),  "EX", ttlSeconds ).catch(() => {});
  }

  return fresh;
}