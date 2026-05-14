import express from 'express';
import { get_current_user, login_user, register_user } from '../controller/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getAllUserUrls } from '../controller/user.controller.js';
import { attachUser } from '../middleware/attachUser.js';
const router = express.Router();
router.use(attachUser);
router.get("/urls", authMiddleware, getAllUserUrls)

export default router;