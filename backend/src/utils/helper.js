
import { jwtVerify, SignJWT } from "jose";
import { ValidationError } from "./appError.js";
import crypto from "crypto";
import {
  findUserById,
  verifyEmailVerificationTokenDao,
  verifyPasswordResetTokenDao,
} from "../dao/user.dao.js";
import config from "../config/index.js";
import idGenerator from "./idGenerator.js";
export const generateShortUrl = async() => {
  const id = await idGenerator.generateId();
  return id;
};

export const generateAccessToken = (userId) => {
  const secret = new TextEncoder().encode(config.jwt.accessTokenSecret);
  const token = new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(config.jwt.accessTokenExpiresIn)
    .sign(secret);
  return token;
};

export const generateRefreshToken = (userId) => {
  const secret = new TextEncoder().encode(config.jwt.refreshTokenSecret);
  const token = new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(config.jwt.refreshTokenExpiresIn)
    .sign(secret);
  return token;
};

export const verifyToken = async (token) => {
  const secret = new TextEncoder().encode(config.jwt.accessTokenSecret);
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    throw new ValidationError("Invalid token");
  }
};
export const verifyRefreshToken = async (token) => {
  const secret = new TextEncoder().encode(config.jwt.refreshTokenSecret);
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    throw new ValidationError("Invalid token");
  }
};

export const generateVerificationToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hashedToken };
};

export const generateRandomToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

export const verifyEmailVerificationToken = async (token) => {
  const hashedIncomingToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await verifyEmailVerificationTokenDao(hashedIncomingToken);
  return user;
};
export const verifyPasswordResetToken = async (token) => {
  const hashedIncomingToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await verifyPasswordResetTokenDao(hashedIncomingToken);
  return user;
};

export const generateValidationErrors = (validated) => {
  const errors = {};
  validated.error.issues.forEach((issue) => {
    const field = issue.path[0];
    if (!errors[field]) {
      errors[field] = issue.message;
    }
  });
  return errors;
};

export const isValidRedirectUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const getUserByAccessToken = async (accessToken) => {
  try{

    const decoded = await verifyToken(accessToken);
    const user = await findUserById(decoded.userId);
    if (!user) {
      return null;
    }
    const userObj = user.toObject();
    return userObj;
  }catch(err){
    return null
  }
};


