import { User } from "../models/user.model.js";

export const findUserByEmailWithPassword = async (email) => {
  return User.findOne({ email }).select("+password");
};
export const findUserByEmail = async (email) => {
  return User.findOne({ email });
};

export const findUserById = async (id) => {
  return User.findById(id);
};

export const createUser = async (name, email, password) => {
  const user = new User({ name, email, password });
  await user.save();
  return user;
};


export const saveVerificationToken = async (user, verificationToken) => {
  user.verificationToken = verificationToken;
  user.verificationTokenExpires = Date.now() + 10 * 60 * 1000;
  await user.save();
};
export const savePasswordResetToken = async (user, token) => {
  user.passwordResetToken = token;
  user.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000;
  await user.save();
};
export const verifyEmailVerificationTokenDao = async (verificationToken) => {
  const user = await User.findOne({
    verificationToken,
    verificationTokenExpires: { $gt: Date.now() },
  });
  return user;
};
export const verifyPasswordResetTokenDao = async (passwordResetToken) => {
  const user = await User.findOne({
    passwordResetToken,
    passwordResetTokenExpires: { $gt: Date.now() },
  });
  return user;
};

export const removePasswordResetToken = async (user) => {
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  await user.save();
};

export const setEmailVerified = async (user) => {
  user.isVerified = true;
  await user.save();
};

export const updatePassword = async (user, password) => {
  user.password = password;
  await user.save();
};
