import express from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import {getOverallBreakdown, getOverallLeaderboard, getOverallSummary, getOverallTimeseries, getUrlBreakdown, getUrlSummary, getUrlTimeseries} from '../controller/analytics.controller.js'
const router = express.Router()

// gives overall results
router.get('/summary', authMiddleware, getOverallSummary);
router.get('/timeseries', authMiddleware, getOverallTimeseries);
router.get('/breakdown', authMiddleware, getOverallBreakdown);
router.get('/leaderboard', authMiddleware, getOverallLeaderboard)

// gives results for specific urls
router.get('/summary/:id', authMiddleware, getUrlSummary);
router.get('/timeseries/:id', authMiddleware, getUrlTimeseries);
router.get('/breakdown/:id', authMiddleware, getUrlBreakdown);



export default router;