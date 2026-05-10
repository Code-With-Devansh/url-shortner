import express from 'express';
import { get_current_user, login_user, register_user } from '../controller/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post("/register", registerLimiter, register_user)
router.post("/login", loginLimiter, login_user)
router.get("/me",authMiddleware, get_current_user);
export default router;