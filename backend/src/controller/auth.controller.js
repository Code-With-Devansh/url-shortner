import {
  deviceIdCookieOptions,
  refreshTokenCookieOptions,
} from "../config/cookieConfig.js";
import {
  findUserByEmail,
  findUserById,
  removePasswordResetToken,
  setEmailVerified,
  updatePassword,
} from "../dao/user.dao.js";
import {
  delAllRefreshTokens,
  delRefreshToken,
  saveRefreshToken,
} from "../dao/refreshToken.dao.js";
import {
  cacheRefreshToken,
  delAllCachedRefreshTokens,
  delCachedRefreshToken,
  delSessionTokenFromRedis,
} from "../cache/user.redis.js";
import {
  checkIfRefreshTokenExists,
  generateAndStorePasswordResetToken,
  generateAndStoreVerificationToken,
  loginUser,
  queueEmailVerification,
  registerUser,
  storeSessionToken,
  verifySessionToken,
} from "../services/auth.service.js";
import {
  sendEmailVerificationMail,
  sendpasswordResetMail,
} from "../services/resend.service.js";
import {
  generateAccessToken,
  generateRandomToken,
  generateRefreshToken,
  generateValidationErrors,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
  verifyToken,
} from "../utils/helper.js";
import tryCatch from "../utils/tryCatch.js";
import { ErrorCodes } from "../utils/errorCodes.js";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../utils/appError.js";
import UserSchema from "../schema/auth.schema.js";
import { addClient, notifyClient, removeClient } from "../utils/sseClient.js";
import logger from "../logger/index.js";
import {
  toUserDTO,
  toLoginResponseDTO,
  toRegisterResponseDTO,
  toAuthResponseDTO,
  toVerificationLinkResponseDTO,
} from "../dto/auth.dto.js";
import config from "../config/index.js";

export const register_user = tryCatch(async (req, res, next) => {
  const { name, email, password } = req.body;
  const validated = UserSchema.safeParse({ name, email, password });

  if (!validated.success) {
    const errors = generateValidationErrors(validated);
    throw new ValidationError(errors);
  }

  const { user } = await registerUser(name, email, password);
  res.status(201).json(toRegisterResponseDTO(user));
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
  let deviceId = req.cookies.deviceId;
  const isNewDevice = !deviceId;
  if (isNewDevice) {
    deviceId = crypto.randomUUID();
  }

  const deviceInfo = {
    deviceId,
    ip: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 200) ?? "Unknown",
    lastSeen: new Date(),
  };
  const { user, accessToken, refreshToken } = await loginUser(
    email,
    password,
    deviceInfo,
  );
  if (!accessToken) {
    throw new UnauthorizedError(
      "User is not Verified.",
      ErrorCodes.AUTH_EMAIL_NOT_VERIFIED,
    );
  }
  if (isNewDevice) {
    res.cookie("deviceId", deviceId, deviceIdCookieOptions);
  }
  res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
  res.status(200).json(toLoginResponseDTO(user, accessToken));
}, "Login User");

export const get_current_user = tryCatch(async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: toUserDTO(req.user),
    message: "Current user fetched successfully",
  });
}, "get Current User");

export const refreshAccessToken = tryCatch(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  let deviceId = req.cookies.deviceId;
  if (!refreshToken || !deviceId)
    throw new UnauthorizedError(
      "Session expired. Please login again.",
      ErrorCodes.AUTH_SESSION_EXPIRED,
    );
  const deviceInfo = {
    deviceId,
    ip: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 200) ?? "Unknown",
    lastSeen: new Date(),
  };
  const data = await verifyRefreshToken(refreshToken);
  const userId = data.userId;
  const stored = await checkIfRefreshTokenExists(
    userId,
    refreshToken,
    deviceId,
  );
  if (!stored) {
    await delAllCachedRefreshTokens(userId);
    await delAllRefreshTokens(userId);
    throw new UnauthorizedError(
      "Session expired. Please login again.",
      ErrorCodes.AUTH_SESSION_EXPIRED,
    );
  }
  await delCachedRefreshToken(userId, deviceId);
  await delRefreshToken(userId, deviceId);
  const newAccessToken = await generateAccessToken(userId);
  const newRefreshToken = await generateRefreshToken(userId);
  await cacheRefreshToken(userId, newRefreshToken, deviceId);
  await saveRefreshToken(userId, newRefreshToken, deviceInfo);
  res.cookie("refreshToken", newRefreshToken, refreshTokenCookieOptions);
  res.json({
    success: true,
    message: "Access Token refreshed.",
    data: {
      accessToken: newAccessToken,
    },
  });
}, "Refresh Access Token");

export const logout_user = tryCatch(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  const deviceId = req.cookies.deviceId;
  if (!refreshToken || !deviceId) {
    return res.json(toAuthResponseDTO("Already logged out"));
  }
  const data = await verifyRefreshToken(refreshToken).catch(() => null);
  if (data) {
    await delCachedRefreshToken(data.userId, deviceId);
    await delRefreshToken(data.userId, deviceId);
  }
  res.clearCookie("refreshToken", refreshTokenCookieOptions);
  res.json(toAuthResponseDTO("Logout successfully"));
}, "logout");

export const sendVerificationLink = tryCatch(async (req, res, next) => {
  const { email } = req.body;
  const validated = UserSchema.pick({ email }).safeParse({ email });
  if (!validated.success) {
    throw new ValidationError(generateValidationErrors(validated));
  }
  const sessionToken = generateRandomToken();
  const user = await findUserByEmail(email);
  if (!user || user.isVerified) {
    return res.json(toVerificationLinkResponseDTO(sessionToken));
  }
  await storeSessionToken(user, sessionToken);
  await queueEmailVerification(user);
  res.send(toAuthResponseDTO("Verification Link Sent", sessionToken));
}, "Send verification Link");

export const verifyEmail = tryCatch(async (req, res, next) => {
  const { token } = req.params;
  const user = await verifyEmailVerificationToken(token);
  if (!user) {
    throw new ValidationError(
      { token: "Invalid Token" },
      ErrorCodes.AUTH_EMAIL_VERIFICATION_FAILED,
    );
  }
  const userId = user._id.toString();
  await setEmailVerified(user);
  notifyClient(user._id.toString(), "verified", {
    success: true,
  });
  res.redirect(config.app.frontendUrl + "/auth/email-verified");
}, "verify Email");

export const forgotPassword = tryCatch(async (req, res, next) => {
  const { email } = req.body;
  const validated = UserSchema.pick({ email }).safeParse({ email });
  if (!validated.success) {
    throw new ValidationError(generateValidationErrors(validated));
  }
  const token = await generateAndStorePasswordResetToken(email);
  if (!token) {
    return res.send(toAuthResponseDTO("Email sent successfully."));
  }
  await sendpasswordResetMail(
    email,
    config.app.frontendUrl + `auth/change-password/${token}`,
  );
  res.send(toAuthResponseDTO("Email sent successfully."));
}, "forgot Password");

export const changePassword = tryCatch(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;
  const validated = UserSchema.pick({ password: true }).safeParse({ password });
  if (!validated.success) {
    throw new ValidationError(generateValidationErrors(validated));
  }
  const user = await verifyPasswordResetToken(token);
  if (!user) {
    throw new UnauthorizedError(
      "Reset token is invalid or has expired.",
      ErrorCodes.AUTH_TOKEN_INVALID,
    );
  }
  await removePasswordResetToken(user);
  await updatePassword(user, password);
  res.send(toAuthResponseDTO("password updated successfully."));
}, "Change Password");

export const verificationStatus = tryCatch(async (req, res, next) => {
  const sessionToken = req.query.token;
  const userId = await verifySessionToken(sessionToken);
  if (!userId) {
    throw new UnauthorizedError(
      "Session token is invalid or has expired.",
      ErrorCodes.AUTH_TOKEN_INVALID,
    );
  }
  await delSessionTokenFromRedis(sessionToken);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  try {
    if (userId) {
      addClient(userId, res);
      logger.info({ userId }, "SSE connection opened");
    } else {
      logger.info("SSE connection opened for unmatched email");
    }
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 30000);
    req.on("close", () => {
      clearInterval(heartbeat);
      if (userId) {
        removeClient(userId);
        logger.info({ userId }, "SSE connection closed");
      }
    });
  } catch (err) {
    res.write(
      `event: error\ndata: ${JSON.stringify({
        message: "Internal server error",
      })}\n\n`,
    );
    res.end();
  }
}, "Verification Status");
