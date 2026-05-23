import { AccessTokenCookieOptions } from "../config/config.js";
import { findUserById } from "../dao/user.dao.js";
import { checkIfRefreshTokenExists } from "../services/auth.service.js";
import { UnauthorizedError } from "../utils/appError.js";
import {
  generateAccessToken,
  verifyRefreshToken,
  verifyToken,
} from "../utils/helper.js";

export const authMiddleware = async (req, res, next) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  if (!accessToken && !refreshToken) {
    return next(new UnauthorizedError("No tokens provided"));
  }

  try {
    if (accessToken) {
      try {
        const decoded = await verifyToken(accessToken);
        const user = await findUserById(decoded.userId);
        if (!user) {
          res.clearCookie("accessToken");
          res.clearCookie("refreshToken");
          throw new UnauthorizedError("User not found");
        }
        req.user = user;
        return next();
      } catch (err) {
        // Access token failed → continue to refresh
      }
    }
    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token missing");
    }
    const data = await verifyRefreshToken(refreshToken);
    const stored = await checkIfRefreshTokenExists(data.userId, refreshToken);
    if (!stored) {
      throw new UnauthorizedError("Invalid refresh token");
    }
    const user = await findUserById(data.userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    const newAccessToken = generateAccessToken(data.userId);
    res.cookie("accessToken", newAccessToken, AccessTokenCookieOptions);
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
