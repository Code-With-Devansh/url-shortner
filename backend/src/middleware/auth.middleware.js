
import { checkIfRefreshTokenExists } from "../services/auth.service.js";
import { UnauthorizedError } from "../utils/appError.js";
import { ErrorCodes } from "../utils/errorCodes.js";
import {
  generateAccessToken,
  getUserByAccessToken,
} from "../utils/helper.js";

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const accessToken = authHeader?.split(" ")[1];

  if (!accessToken) {
    return next(new UnauthorizedError("No access token provided", ErrorCodes.AUTH_UNAUTHENTICATED));
  }
  try {
    const user = await getUserByAccessToken(accessToken);
    if (user) {
      req.user = { ...user, accessToken };
      return next();
    }else{
      throw new UnauthorizedError("Invalid or expired access token", ErrorCodes.AUTH_UNAUTHENTICATED);
    }
  } catch (err) {
    next(err);
  }
};
