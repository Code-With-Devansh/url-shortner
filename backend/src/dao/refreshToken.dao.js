import { RefreshToken } from "../models/refreshToken.model.js";
import { refreshTokenCookieOptions } from "../config/config.js";
import crypto from "crypto";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}


export const saveRefreshToken = async (user, token, deviceInfo) => {
  const hashedToken = hashToken(token); 
  const expiresAt = new Date(Date.now() + refreshTokenCookieOptions.maxAge);

  const refreshToken = await RefreshToken.findOneAndUpdate(
    {
      user: user._id,
      "deviceInfo.deviceId": deviceInfo.deviceId, 
    },
    {
      $set: {
        token: hashedToken,
        expiresAt,
        deviceInfo: {
          ...deviceInfo,
          lastSeen: new Date(),
        },
      },
    },
    {
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  return refreshToken;
};

export const checkIfRefreshTokenExistsDao = async (
  userId,
  refreshToken,
  deviceId,
) => {
  const session = await RefreshToken.findOne({
    user: userId,
    "deviceInfo.deviceId": deviceId,
  });
  if (!session) return null;
  return session.compareToken(refreshToken) ? session : null;
};

export const delRefreshToken = async (userId, deviceId) => {
  return await RefreshToken.deleteOne({
    user: userId,
    "deviceInfo.deviceId": deviceId,
  });
};

export const delAllRefreshTokens = async (userId) => {
  await RefreshToken.deleteMany({ user: userId });
};
