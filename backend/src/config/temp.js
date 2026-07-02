import config from "./index.js";

const isProd = config.app.env === "production";

export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 1000 * 60 * 60 * 24 * 20,
};

export const deviceIdCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  maxAge: 1000 * 60 * 60 * 24 * 365,
};