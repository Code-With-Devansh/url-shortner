import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { authenticatedApiLimiter } from '../middleware/rateLimiter.js';
import { getAllUserUrls } from '../controller/user.controller.js';
const router = express.Router();
router.get("/urls", authMiddleware, authenticatedApiLimiter, getAllUserUrls)

export default router;