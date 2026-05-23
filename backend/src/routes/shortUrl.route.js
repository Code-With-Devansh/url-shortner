import express from 'express';
import { createShortUrl, deleteShortUrl, trackClick } from '../controller/shortUrl.controller.js';
import { shortenLimiter } from '../middleware/rateLimiter.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { attachUser } from '../middleware/attachUser.js';
const router = express.Router();
router.post("/create", shortenLimiter, attachUser, createShortUrl );
router.delete('/delete/:id', authMiddleware, deleteShortUrl);
router.post('/clicks/:shortId', trackClick)
export default router;