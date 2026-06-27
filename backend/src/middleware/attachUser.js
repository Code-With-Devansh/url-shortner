import { findUserById } from "../dao/user.dao.js";
import { checkIfRefreshTokenExists } from "../services/auth.service.js";
import {
  generateAccessToken,
  getUserByAccessToken,
  verifyRefreshToken,
  verifyToken,
} from "../utils/helper.js";

export const attachUser = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const accessToken = authHeader?.split(" ")[1];
  try {
    const user = await getUserByAccessToken(accessToken);
    if (user) {
      req.user = { ...user };
      return next();
    }
    next();
  } catch (err) {
    next(err);
  }
};
