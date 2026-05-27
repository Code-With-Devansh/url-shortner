import { RefreshToken } from "../models/refreshToken.model.js";
import { refreshTokenCookieOptions } from "../config/config.js";

export const saveRefreshToken = async (user, token) => {
  let refreshToken = await RefreshToken.findOne({
    user: user._id,
  });

  if (!refreshToken) {
    refreshToken = new RefreshToken({
      user: user._id,
      token,
      expiresAt: new Date(Date.now() + refreshTokenCookieOptions.maxAge),
    });
  } else {
    refreshToken.token = token;
    refreshToken.expiresAt = new Date(
      Date.now() + refreshTokenCookieOptions.maxAge,
    );
  }

  await refreshToken.save();
  return refreshToken;
};

export const checkIfRefreshTokenExistsDao = async (id, refreshToken) => {
  const tokenDoc = await RefreshToken.findOne({
    user: id,
  });
  if (!tokenDoc) return null;
  const isMatch = tokenDoc.compareToken(refreshToken);
  return isMatch ? tokenDoc : null;
};


export const delRefreshToken = async (userId) => {
  return await RefreshToken.deleteOne({ user: userId });
};
