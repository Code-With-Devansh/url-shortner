import express from "express";
import {
  createShortUrl,
  deleteShortUrl,
} from "../controller/shortUrl.controller.js";
import {
  shortenLimiterAuthenticated,
  shortenLimiterAnonymous,
} from "../middleware/rateLimiter.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { attachUser } from "../middleware/attachUser.js";
const router = express.Router();
router.post(
  "/create",
  attachUser,
  shortenLimiterAuthenticated,
  shortenLimiterAnonymous,
  createShortUrl,
);
router.delete("/:id", authMiddleware, deleteShortUrl);
export default router;
