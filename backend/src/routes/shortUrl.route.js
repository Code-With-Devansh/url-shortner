import express from 'express';
import { createShortUrl, deleteShortUrl } from '../controller/shortUrl.controller.js';
import { shortenLimiter } from '../middleware/rateLimiter.js';
import { attachUser } from '../middleware/attachUser.js';
const router = express.Router();
router.use(attachUser);
router.post("/create", shortenLimiter, createShortUrl );
router.delete('/delete/:id', deleteShortUrl);

export default router;