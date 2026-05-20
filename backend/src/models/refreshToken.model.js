import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
  },
  token: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0,
  },
});

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
