import express from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { authenticatedApiLimiter } from '../middleware/rateLimiter.js'
import {getOverallBreakdown, getOverallLeaderboard, getOverallSummary, getOverallTimeseries, getUrlBreakdown, getUrlSummary, getUrlTimeseries} from '../controller/analytics.controller.js'
const router = express.Router()
router.use(authMiddleware, authenticatedApiLimiter);

// gives overall results
router.get('/summary', getOverallSummary);
router.get('/timeseries', getOverallTimeseries);
router.get('/breakdown', getOverallBreakdown);
router.get('/leaderboard', getOverallLeaderboard)

// gives results for specific urls
router.get('/summary/:id', getUrlSummary);
router.get('/timeseries/:id', getUrlTimeseries);
router.get('/breakdown/:id', getUrlBreakdown);



export default router;