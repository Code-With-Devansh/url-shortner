import { nanoid } from "nanoid";
import { jwtVerify, SignJWT } from "jose";
import { ValidationError } from "./appError.js";
import crypto from "crypto";
import {
  findUserById,
  verifyEmailVerificationTokenDao,
  verifyPasswordResetTokenDao,
} from "../dao/user.dao.js";
export const generateShortUrl = (length = 7) => {
  const id = nanoid(7);
  return id;
};

export const generateAccessToken = (userId) => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(secret);
  return token;
};

export const generateRefreshToken = (userId) => {
  const secret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);
  const token = new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("20d")
    .sign(secret);
  return token;
};

export const verifyToken = async (token) => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    throw new ValidationError("Invalid token");
  }
};
export const verifyRefreshToken = async (token) => {
  const secret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET);
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
