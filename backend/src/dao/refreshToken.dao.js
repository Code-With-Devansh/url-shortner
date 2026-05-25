import { RefreshToken } from "../models/refreshToken.model.js";
import { refreshTokenCookieOptions } from "../config/config.js";

// remain modification. allow multiple devices.
export const saveRefreshToken = async (user, token) => {
  const refreshToken = new RefreshToken({
    user: user._id,
    token: token,
    expiresAt: new Date(Date.now() + refreshTokenCookieOptions.maxAge),
  });
  await RefreshToken.findOneAndUpdate(
    { user: user._id },
    {
      token,
      expiresAt: new Date(Date.now() + refreshTokenCookieOptions.maxAge),
    },
    { returnDocument: "after" },
  );
};

export const checkIfRefreshTokenExistsDao = async (id, refreshToken) => {
  return await RefreshToken.findOne({ user: id, token: refreshToken });
};

export const delRefreshToken = async (userId) => {
  return await RefreshToken.deleteOne({ user: userId });
};
