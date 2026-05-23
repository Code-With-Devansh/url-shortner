import { AccessTokenCookieOptions } from "../config/config.js";
import { findUserById } from "../dao/user.dao.js";
import { checkIfRefreshTokenExists } from "../services/auth.service.js";
import { generateAccessToken, verifyRefreshToken, verifyToken } from "../utils/helper.js";

export const attachUser = async (req, res, next) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  try {
    if (accessToken) {
      const decoded = await verifyToken(accessToken);
      const user = await findUserById(decoded.userId);
      if (user) {
        req.user = user;
      }
      return next();
    }
    
    if (refreshToken) {
      const data = await verifyRefreshToken(refreshToken);
      const stored = await checkIfRefreshTokenExists(data.userId, refreshToken);
      if (!stored) {
        return next();
      }
      const user = await findUserById(data.userId);
      if (user) {
        const newAccessToken = await generateAccessToken(data.userId);
        res.cookie("accessToken", newAccessToken, AccessTokenCookieOptions);
        req.user = user;
      }
    }
    next();
  } catch(err) {
    console.error(err)
    next();
  }
};
