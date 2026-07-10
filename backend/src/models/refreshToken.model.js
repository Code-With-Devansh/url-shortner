import mongoose from "mongoose";
import crypto from "crypto";

const refreshTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
    index: true,
  },
  deviceInfo: {
    deviceId: { type: String, index: true, required: true },
    ip: String,
    userAgent: String,
    lastSeen: Date,
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0,
  },
});
refreshTokenSchema.index({ user: 1, expiresAt: 1 });
refreshTokenSchema.index(
  { user: 1, "deviceInfo.deviceId": 1 },
  { unique: true },
);
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

refreshTokenSchema.pre("save", function () {
  if (!this.isModified("token")) return;

  this.token = hashToken(this.token);
});

refreshTokenSchema.methods.compareToken = function (candidateToken) {
  return hashToken(candidateToken) === this.token;
};

export const RefreshToken =
  mongoose.models.RefreshToken ||
  mongoose.model("RefreshToken", refreshTokenSchema);
