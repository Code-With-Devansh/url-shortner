import { RefreshToken } from "../models/refreshToken.model.js";
import { refreshTokenCookieOptions } from "../config/config.js";

export const saveRefreshToken = async (user, token, deviceInfo = {}) => {
  const refreshToken = new RefreshToken({
    user: user._id,
    token,                  
    deviceInfo,
    expiresAt: new Date(Date.now() + refreshTokenCookieOptions.maxAge),
  });
  await refreshToken.save();
  return refreshToken;
};

export const checkIfRefreshTokenExistsDao = async (userId, refreshToken) => {
  const docs = await RefreshToken.find({ user: userId });
  for (const doc of docs) {
    if (doc.compareToken(refreshToken)) return doc;
  }
  return null;
};

export const delRefreshToken = async (userId, refreshToken) => {
  const doc = await checkIfRefreshTokenExistsDao(userId, refreshToken);
  if (doc) await RefreshToken.deleteOne({ _id: doc._id });
};

export const delAllRefreshTokens = async (userId) => {
  await RefreshToken.deleteMany({ user: userId });
};