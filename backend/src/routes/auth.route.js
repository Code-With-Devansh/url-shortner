import express from 'express';
import { changePassword, forgotPassword, get_current_user, login_user, logout_user, refreshAccessToken, register_user, sendVerificationLink, verificationStatus, verifyEmail } from '../controller/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { loginLimiter, registerLimiter, emailLimiter, refreshLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post("/register", registerLimiter, register_user)
router.post("/login", loginLimiter, login_user)
router.get("/me",authMiddleware, get_current_user);
router.post("/refresh", refreshLimiter, refreshAccessToken)
router.post("/send-verification-link", emailLimiter, sendVerificationLink)
router.get("/verify-email/:token", verifyEmail)
router.post("/forgot-password", emailLimiter, forgotPassword)
router.post("/change-password/:token", changePassword)
router.get("/verify-status", verificationStatus);
router.post("/logout", logout_user)
export default router;