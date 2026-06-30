import crypto from "crypto";
import redis from "../config/redis.config.js";

const SESSION_TTL = 60 * 60 * 24 * 20; // 20 days

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const sessionKey = (userId, deviceId) => `refresh:${userId}:${deviceId}`;
const sessionIndexKey = (userId) => `user_sessions:${userId}`;

export const cacheRefreshToken = async (userId, refreshToken, deviceId) => {
  const key = sessionKey(userId, deviceId);

  const multi = redis.multi();

  multi.set(key, hashToken(refreshToken), "EX", SESSION_TTL);

  multi.sadd(sessionIndexKey(userId), key);

  multi.expire(sessionIndexKey(userId), SESSION_TTL);

  await multi.exec();
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

  if (!storedHash) {
    await redis.srem(sessionIndexKey(userId), sessionKey(userId, deviceId));
    return false;
  }

  return storedHash === hashToken(refreshToken);
};

export const delCachedRefreshToken = async (userId, deviceId) => {
  const key = sessionKey(userId, deviceId);

  const multi = redis.multi();

  multi.del(key);
  multi.srem(sessionIndexKey(userId), key);

  await multi.exec();
};

export const delAllCachedRefreshTokens = async (userId) => {
  const indexKey = sessionIndexKey(userId);
  const sessionKeys = await redis.smembers(indexKey);

  const multi = redis.multi();

  if (sessionKeys.length) {
    multi.del(...sessionKeys);
  }

  multi.del(indexKey);

  await multi.exec();
};

export const saveSessionTokenToRedis = async (userId, sessionToken, ttl) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex");
  await await redis.set(`session:${hashedToken}`, userId, "EX", ttl);
};

export const delSessionTokenFromRedis = async (sessionToken) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex"); 
  await redis.del(`session:${hashedToken}`);
};

export const getUserIdBySessionToken = async (sessionToken) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex");
  return await redis.get(`session:${hashedToken}`);
};

export const saveClaimRecord = async (hashedClaimToken, { userId, deviceId }, ttlSeconds) => {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await redis.set(
    `claim:${hashedClaimToken}`,
    JSON.stringify({ userId, deviceId, expiresAt }),
    "EX",
    ttlSeconds,
  );
};

export const readAndDeleteClaimRecord = async (hashedClaimToken) => {
  const raw = await redis.getdel(`claim:${hashedClaimToken}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
