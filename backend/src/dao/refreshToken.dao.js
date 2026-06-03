import { RefreshToken } from "../models/refreshToken.model.js";
import { refreshTokenCookieOptions } from "../config/config.js";

export const saveRefreshToken = async (user, token, deviceInfo) => {
  const refreshToken = new RefreshToken({
    user: user._id,
    token,
    deviceInfo,
    expiresAt: new Date(Date.now() + refreshTokenCookieOptions.maxAge),
  });
  await refreshToken.save();
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

export const delRefreshToken = async(userId, deviceId) =>{
  return await RefreshToken.deleteOne({
    user: userId,
    "deviceInfo.deviceId": deviceId,
  });
}

export const delAllRefreshTokens = async (userId) => {
  await RefreshToken.deleteMany({ user: userId });
};
