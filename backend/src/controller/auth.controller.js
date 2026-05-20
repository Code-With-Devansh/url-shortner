import {
  AccessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "../config/config.js";
import {
  findUserByEmail,
  removePasswordResetToken,
  setEmailVerified,
  updatePassword,
} from "../dao/user.dao.js";
import { delRefreshToken, saveRefreshToken } from "../dao/refreshToken.dao.js";
import { cacheRefreshToken } from "../dao/user.redis.js";
import {
  checkIfRefreshTokenExists,
  generateAndStorePasswordResetToken,
  generateAndStoreVerificationToken,
  loginUser,
  registerUser,
} from "../services/auth.service.js";
import {
  sendEmailVerificationMail,
  sendpasswordResetMail,
} from "../services/resend.service.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateValidationErrors,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
  verifyToken,
} from "../utils/helper.js";
import tryCatch from "../utils/tryCatch.js";
import { NotFoundError, ValidationError } from "../utils/appError.js";
import UserSchema from "../schema/auth.schema.js";

export const register_user = tryCatch(async (req, res, next) => {
  const { name, email, password } = req.body;
  const validated = UserSchema.safeParse({ name, email, password });

  if (!validated.success) {
    const errors = generateValidationErrors(validated);
    throw new ValidationError(errors);
  }

  const { accessToken, refreshToken, user } = await registerUser(
    name,
    email,
    password,
  );
  res.cookie("accessToken", accessToken, AccessTokenCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
  res.status(201).json({
    success: true,
    data: user,
    message: "User registered successfully",
  });
}, "Register user");

export const login_user = tryCatch(async (req, res, next) => {
  const { email, password } = req.body;
  const validated = UserSchema.pick({ email: true, password: true }).safeParse({
    email,
    password,
  });
  if (!validated.success) {
    throw new ValidationError(generateValidationErrors(validated));
  }
  const { accessToken, refreshToken, user } = await loginUser(email, password);
  res.cookie("accessToken", accessToken, AccessTokenCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
  res.status(200).json({
    success: true,
    data: user,
    message: "User logged in successfully",
  });
}, "Login User");

export const get_current_user = tryCatch(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: req.user,
    message: "Current user fetched successfully",
  });
}, "get Current User");

export const refreshAccessToken = tryCatch(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  if (!token)
    return res
      .status(401)
      .json({ success: false, message: "No refresh Token" });

  const data = verifyRefreshToken(refreshToken);
  const userId = data.userId;
  const stored = checkIfRefreshTokenExists(userId, refreshToken);
  const newAccessToken = generateAccessToken(userId);
  const newRefreshToken = generateRefreshToken(userId);
  cacheRefreshToken(newRefreshToken);
  saveRefreshToken(newRefreshToken);
  res.cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions);
  res.cookie("accessToken", newAccessToken, AccessTokenCookieOptions);
  res.json({ success: true, message: "Access Token refreshed." });
}, "Refresh Access Token");

export const logout_user = tryCatch(async (req, res, next) => {
  refreshToken = req.cookies.refreshToken;
  const data = await verifyRefreshToken(refreshToken);
  if (data) {
    const userId = data.userId;
    await delCachedRefreshToken(userId);
    await delRefreshToken(userId);
  }
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({
    success: true,
    message: "Logout successfully",
  });
}, "logout");

export const sendVerificationLink = tryCatch(async (req, res, next) => {
  const { email } = req.user;
  const validated = UserSchema.pick({ email }).safeParse({ email });
  if (!validated.success) {
    throw new ValidationError(generateValidationErrors(validated));
  }
  const token = await generateAndStoreVerificationToken(email);
  await sendEmailVerificationMail(
    email,
    process.env.BASE_URL + `api/auth/verify-email/${token}`,
  );
  res.send({ success: true, message: "Verification Link Sent" });
}, "Send verification Link");

export const verifyEmail = tryCatch(async (req, res, next) => {
  const { token } = req.params;
  const user = await verifyEmailVerificationToken(token);
  if (!user) {
    res.send({ success: false, message: "Email verification failed" });
  }
  await setEmailVerified(user);
  res.send({ success: true, message: "Email Verified" });
}, "verify Email");

export const forgotPassword = tryCatch(async (req, res, next) => {
  const { email } = req.body;
  const validated = UserSchema.pick({ email }).safeParse({ email });
  const token = await generateAndStorePasswordResetToken(email);
  await sendpasswordResetMail(
    email,
    process.env.APP_URL + `auth/change-password/${token}`,
  );
  res.send({ success: true, message: "Email sent successfully." });
}, "forgot Password");

export const changePassword = tryCatch(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;
  const validated = UserSchema.pick({ password: true }).safeParse({ password });
  if (!validated) {
    throw new ValidationError(generateValidationErrors(validated));
  }
  const user = await verifyPasswordResetToken(token);
  if (!user) {
    throw new ValidationError("Token invalid");
  }
  await removePasswordResetToken(user);
  await updatePassword(user, password);
  res.send({ success: true, message: "password updated successfully." });
}, "Change Password");
