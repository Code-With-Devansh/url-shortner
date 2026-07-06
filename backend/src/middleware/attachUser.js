import {
  getUserByAccessToken,
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
