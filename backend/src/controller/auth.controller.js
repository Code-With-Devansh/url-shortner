import {
  AccessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "../config/config.js";
import {
  findUserByEmail,
  findUserById,
  removePasswordResetToken,
  setEmailVerified,
  updatePassword,
} from "../dao/user.dao.js";
import { delRefreshToken, saveRefreshToken } from "../dao/refreshToken.dao.js";
import { cacheRefreshToken, delCachedRefreshToken } from "../dao/user.redis.js";
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
import { addClient, notifyClient, removeClient } from "../utils/sseClient.js";
import logger from "../logger/index.js";

export const register_user = tryCatch(async (req, res, next) => {
  const { name, email, password } = req.body;
  const validated = UserSchema.safeParse({ name, email, password });

  if (!validated.success) {
    const errors = generateValidationErrors(validated);
    throw new ValidationError(errors);
  }

  const { user } = await registerUser(
    name,
    email,
    password,
  );
  res.status(201).json({
    success: true,
    data: {...user},
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
  const { user, accessToken, refreshToken } = await loginUser(email, password);
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
  res.status(200).json({
    success: true,
    data: {...user, accessToken},
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
  res.json({ success: true, message: "Access Token refreshed.",accessToken});
}, "Refresh Access Token");

export const logout_user = tryCatch(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  const data = await verifyRefreshToken(refreshToken);
  if (data) {
    const userId = data.userId;
    await delCachedRefreshToken(userId);
    await delRefreshToken(userId);
  }
  res.clearCookie("refreshToken");
  res.json({
    success: true,
    message: "Logout successfully",
  });
}, "logout");

export const sendVerificationLink = tryCatch(async (req, res, next) => {
  const { email } = req.body;
  const validated = UserSchema.pick({ email }).safeParse({ email });
  if (!validated.success) {
    throw new ValidationError(generateValidationErrors(validated));
  }
  const user = findUserByEmail(email);
  if(!user) return res.json({success:true, message: "Verification Link Sent" });
  if (user.isVerified) return res.json({ success: true, message: "Verification Link Sent" }); 
  const token = await generateAndStoreVerificationToken(email);
  await sendEmailVerificationMail(
    user.name,
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
  const accessToken = await generateAccessToken(user._id.toString());
  const refreshToken = await generateRefreshToken(user._id.toString());
  await cacheRefreshToken(refreshToken, user._id);
  await saveRefreshToken(user, refreshToken);
  const userObj = user.toJSON();
  notifyClient(user._id.toString(), "verified", { success: true, user:{...user, accessToken} });
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
  res.redirect(process.env.APP_URL + "/auth/email-verified");
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

export const verificationStatus = async(req, res) => {
  const email = req.query.email;
  const user = await findUserByEmail(email)
  if(!user){
    throw new ValidationError("some error occurred.")
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const userId = user._id.toString();
  addClient(userId, res);
  logger.info({ userId }, "SSE connection opened");

  req.on("close", () => {
    removeClient(userId);
    logger.info({ userId }, "SSE connection closed");
  });
};
