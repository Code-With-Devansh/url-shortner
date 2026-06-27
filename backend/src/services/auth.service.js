import { checkIfRefreshTokenExistsDao, saveRefreshToken } from "../dao/refreshToken.dao.js";
import {
  createUser,
  findUserByEmail,
  findUserByEmailWithPassword,
  findUserById,
  savePasswordResetToken,
  saveVerificationToken,
} from "../dao/user.dao.js";
import { cacheRefreshToken, checkCachedRefreshToken, getCachedRefreshToken } from "../dao/user.redis.js";
import { emailQueue } from "../queues/queues.js";
import {
  conflictError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/appError.js";
import { ErrorCodes } from "../utils/errorCodes.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateVerificationToken,
} from "../utils/helper.js";

export const registerUser = async (name, email, password) => {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new conflictError("User already exists", ErrorCodes.AUTH_USER_ALREADY_EXISTS);
  }
  const user = await createUser(name, email, password);
  const userObj = user.toJSON()
  return { user:userObj };
};

export const loginUser = async (email, password, deviceInfo = {}) => {
  const user = await findUserByEmailWithPassword(email);
  if (!user || !(await user.comparePassword(password))) {
    throw new UnauthorizedError("Invalid email or password", ErrorCodes.AUTH_INVALID_CREDENTIALS);
  }
  const userObj = user.toJSON();
  if(!user.isVerified){
    return {
      user: userObj,
      accessToken: null,
      refreshToken: null,
    };
  }
  const accessToken = await generateAccessToken(user._id.toString());
  const refreshToken = await generateRefreshToken(user._id.toString());
  await cacheRefreshToken(user._id, refreshToken, deviceInfo?.deviceId);
  await saveRefreshToken(user, refreshToken, deviceInfo);
  return { user:userObj, accessToken, refreshToken };
};

export const checkIfRefreshTokenExists = async(id, refreshToken, deviceId) => {
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

export const generateAndStorePasswordResetToken = async(email)=>{
  const { token, hashedToken } = generateVerificationToken();
  const user = await findUserByEmail(email);
  if (!user) {
    return null
  }
  await savePasswordResetToken(user, hashedToken);
  return token;
}

export const queueEmailVerification = async(user)=>{
  const token = await generateAndStoreVerificationToken(user);
  await emailQueue.add("send-verification-link", {
    to: user.email,
    template: "verification-link",
    name: user.name,
    token:token
  });
}