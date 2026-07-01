import mongoose from "mongoose";
import crypto from 'crypto'
import argon2 from "argon2";
import config from "../config/index.js";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    select: false,
  },
  verificationTokenExpires: {
    type: Date,
    select: false,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetTokenExpires: {
    type: Date,
    select: false,
  },
  avatar: {
    type: String,
    default: function () {
      return getGravatarUrl(this.email);
    },
  },
});

function getGravatarUrl(email) {
  email = (email || "").trim().toLowerCase();

  const hash = crypto.createHash("md5").update(email).digest("hex");

  return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
}

userSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;

    return ret;
  }
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await argon2.hash(this.password + config.passwordPepper, {
    type: argon2.argon2id,
  });
});

userSchema.methods.comparePassword = async function (password) {
  return await argon2.verify(this.password, password + config.passwordPepper);
};

export const User = mongoose.model("User", userSchema);
