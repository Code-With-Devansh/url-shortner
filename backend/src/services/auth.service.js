import {
  checkIfRefreshTokenExistsDao,
  delAllRefreshTokens,
  delRefreshToken,
  saveRefreshToken,
} from "../dao/refreshToken.dao.js";
import crypto from "crypto";
import {
  createUser,
  findUserByEmail,
  findUserByEmailWithPassword,
  findUserById,
  savePasswordResetToken,
  saveVerificationToken,
  setEmailVerified,
} from "../dao/user.dao.js";
import {
  cacheRefreshToken,
  checkCachedRefreshToken,
  delAllCachedRefreshTokens,
  delCachedRefreshToken,
  getCachedRefreshToken,
  getUserIdBySessionToken,
  readAndDeleteClaimRecord,
  saveClaimRecord,
  saveSessionTokenToRedis,
} from "../cache/user.redis.js";
import { emailQueue } from "../queues/queues.js";
import {
  conflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../utils/appError.js";
import { ErrorCodes } from "../utils/errorCodes.js";
import {
  generateAccessToken,
  generateRandomToken,
  generateRefreshToken,
  generateVerificationToken,
  verifyEmailVerificationToken,
  verifyRefreshToken,
} from "../utils/helper.js";
import { notifyClient } from "../utils/sseClient.js";

export const registerUser = async (name, email, password) => {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new conflictError(
      "User already exists",
      ErrorCodes.AUTH_USER_ALREADY_EXISTS,
    );
  }
  const user = await createUser(name, email, password);
  const userObj = user.toJSON();
  return { user: userObj };
};

export const loginUser = async (email, password, deviceInfo = {}) => {
  const user = await findUserByEmailWithPassword(email);
  if (!user || !(await user.comparePassword(password))) {
    throw new UnauthorizedError(
      "Invalid email or password",
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
    );
  }
  const userObj = user.toJSON();
  if (!user.isVerified) {
    return {
      user: userObj,
      accessToken: null,
      refreshToken: null,
    };
  }
  const accessToken = await generateAccessToken(user._id.toString());
  const refreshToken = await generateRefreshToken(user._id.toString());
  await cacheRefreshToken(user._id, refreshToken, deviceInfo?.deviceId);
  await saveRefreshToken(user._id, refreshToken, deviceInfo);
  return { user: userObj, accessToken, refreshToken };
};

export const refreshAccessTokenService = async (
  refreshToken,
  deviceId,
  deviceInfo,
) => {
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
  return { newAccessToken, newRefreshToken };
};

export const logoutUser = async (refreshToken, deviceId) => {
  const data = await verifyRefreshToken(refreshToken).catch(() => null);
  if (data) {
    await delCachedRefreshToken(data.userId, deviceId);
    await delRefreshToken(data.userId, deviceId);
  }
};

export const sendVerificationLinkService = async (email) => {
  const sessionToken = generateRandomToken();
  const user = await findUserByEmail(email);
  if (!user || user.isVerified) {
    return sessionToken
  }
  await storeSessionToken(user, sessionToken);
  await queueEmailVerification(user);
  return sessionToken
};

export const verifyEmailService = async(token)=>{
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
}


export const checkIfRefreshTokenExists = async (id, refreshToken, deviceId) => {
  const cached = await checkCachedRefreshToken(id, deviceId, refreshToken);
  if (cached) {
    return true;
  }
  const user = await checkIfRefreshTokenExistsDao(id, refreshToken, deviceId);
  if (user) {
    await cacheRefreshToken(id, refreshToken, deviceId);
    return true;
  }
};

export const generateAndStoreVerificationToken = async (user) => {
  const { token, hashedToken } = generateVerificationToken();
  await saveVerificationToken(user, hashedToken);
  return token;
};

export const storeSessionToken = async (user, sessionToken) => {
  await saveSessionTokenToRedis(user._id.toString(), sessionToken, 10 * 60);
};

export const verifySessionToken = async (sessionToken) => {
  const userId = await getUserIdBySessionToken(sessionToken);
  return userId;
};

export const generateAndStoreClaimToken = async (userId, deviceId) => {
  const { token, hashedToken } = generateVerificationToken();
  await saveClaimRecord(hashedToken, { userId, deviceId }, 10 * 60);
  return token;
};

export const readAndConsumeClaimToken = async (claimToken) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(claimToken)
    .digest("hex");
  return readAndDeleteClaimRecord(hashedToken);
};

export const generateAndStorePasswordResetToken = async (user) => {
  const { token, hashedToken } = generateVerificationToken();
  if (!user) {
    return null;
  }
  await savePasswordResetToken(user, hashedToken);
  return token;
};

export const queueEmailVerification = async (user) => {
  const token = await generateAndStoreVerificationToken(user);
  await emailQueue.add("send-verification-link", {
    to: user.email,
    template: "verification-link",
    name: user.name,
    token: token,
  });
};
export const queuePasswordReset = async (user) => {
  const token = await generateAndStorePasswordResetToken(user);
  if(token){
    await emailQueue.add("send-ResetPassword-link", {
      to: user.email,
      template: "forgot-password",
      name: user.name,
      token: token,
    });
  }
};
