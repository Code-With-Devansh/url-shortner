
export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "none",
  maxAge: 1000 * 60 * 60 * 24 * 20, // 20d
};

export const deviceIdCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "none",
  maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
};
