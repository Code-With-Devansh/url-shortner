import express from 'express';
import { get_current_user, login_user, register_user } from '../controller/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getAllUserUrls } from '../controller/user.controller.js';
const router = express.Router();
router.get("/urls", authMiddleware, getAllUserUrls)

export default router;