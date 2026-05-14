import express from 'express';
import { get_current_user, login_user, logout_user, refreshAccessToken, register_user } from '../controller/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js';
import { attachUser } from '../middleware/attachUser.js';

const router = express.Router();

router.post("/register", registerLimiter, register_user)
router.post("/login", loginLimiter, login_user)
router.get("/me",authMiddleware, attachUser, get_current_user);
router.post("/refresh", refreshAccessToken)

router.post("/logout", logout_user)
export default router;