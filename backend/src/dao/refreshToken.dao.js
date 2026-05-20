import { RefreshToken } from "../models/refreshToken.model.js";
import { refreshTokenCookieOptions } from "../config/config.js";

export const saveRefreshToken = async (user, token) => {
  const refreshToken = new RefreshToken({
    user: user._id,
    token: token,
    expiresAt: refreshTokenCookieOptions.maxAge,
  });
  await refreshToken.save();
};

export const checkIfRefreshTokenExistsDao = (id, refreshToken) => {
  return RefreshToken.findOne({ user: id, token: refreshToken });
};

export const delRefreshToken = async (userId) => {
  return await RefreshToken.deleteOne({ user: userId });
};