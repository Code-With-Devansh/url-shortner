
import { checkIfRefreshTokenExists } from "../services/auth.service.js";
import { UnauthorizedError } from "../utils/appError.js";
import {
  generateAccessToken,
} from "../utils/helper.js";

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const accessToken = authHeader?.split(" ")[1];

  if (!accessToken) {
    return next(new UnauthorizedError("User Not found"));
  }
  try {
    const user = await getUserByAccessToken(accessToken);
    if (user) {
      req.user = { ...user, accessToken };
      return next();
    }else{
      throw new UnauthorizedError("User not found");
    }
  } catch (err) {
    next(err);
  }
};
