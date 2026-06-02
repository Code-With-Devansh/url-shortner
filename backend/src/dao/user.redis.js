import crypto from "crypto";
import redis from '../config/redis.config.js'

const sessionKey = (userId, token) => {
  const hash = crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
  return `refresh:${userId}:${hash}`;
};


export const cacheRefreshToken = async (refreshToken, userId) => {
  await redis.set(sessionKey(userId, refreshToken), "1", { EX: 60 * 60 * 24 * 20 });
};

export const getCachedRefreshToken = async (userId, token) => {
  return redis.get(sessionKey(userId, token));
};

export const delCachedRefreshToken = async (userId, token) => {
  await redis.del(sessionKey(userId, token));
};

export const delAllCachedRefreshTokens = async (userId) => {
  const keys = await redis.keys(`refresh:${userId}:*`);
  if (keys.length) await redis.del(keys);
};