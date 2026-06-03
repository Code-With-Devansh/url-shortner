import crypto from "crypto";
import redis from "../config/redis.config.js";

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const sessionKey = (userId, deviceId) => `refresh:${userId}:${deviceId}`;

export const cacheRefreshToken = async (userId, refreshToken, deviceId) => {
  await redis.set(
    sessionKey(userId, deviceId),
    hashToken(refreshToken),
    { EX: 60 * 60 * 24 * 20 }, // 20 days
  );
};

export const getCachedRefreshToken = async (userId, deviceId) => {
  return redis.get(sessionKey(userId, deviceId));
};

export const checkCachedRefreshToken = async (
  userId,
  deviceId,
  refreshToken,
) => {
  const storedHash = await redis.get(sessionKey(userId, deviceId));

  if (!storedHash) return false;

  return storedHash === hashToken(refreshToken);
};

export const delCachedRefreshToken = async (userId, deviceId) => {
  await redis.del(sessionKey(userId, deviceId));
};

export const delAllCachedRefreshTokens = async (userId) => {
  const pattern = `refresh:${userId}:*`;

  for await (const key of redis.scanIterator({
    MATCH: pattern,
  })) {
    await redis.del(key);
  }
};
