import { getOverallAnalyticsBreakdown, getOverallAnalyticsLeaderboard, getOverallAnalyticsSummary, getOverallAnalyticsTimeseries, getUrlAnalyticsBreakdown, getUrlAnalyticsSummary, getUrlAnalyticsTimeseries } from "../services/analytics.service.js";
import tryCatch from "../utils/tryCatch.js";

// Per - Url
export const getUrlSummary = tryCatch(async (req, res, next) => {
  const id = req.params.id;
  const data = await getUrlAnalyticsSummary(
    req.params.id,
    req.user._id,
    req.query.range,
  );
  res.status(200).json({ success: true, data });
}, "getUrlSummary ");

export const getUrlTimeseries = tryCatch(async (req, res, next) => {
  const data = await getUrlAnalyticsTimeseries(
    req.params.id,
    req.user._id,
    req.query.range,
  );
  res.status(200).json({ success: true, data });
}, "getUrlTimeseries");

export const getUrlBreakdown = tryCatch(async (req, res, next) => {
  const data = await getUrlAnalyticsBreakdown(
    req.params.id,
    req.user._id,
    req.query.range,
    req.query.by,
  );
  res.status(200).json({ success: true, data });
}, "getUrlBreakdown");

// Overall
export const getOverallSummary = tryCatch(async (req, res, next) => {
  const data = await getOverallAnalyticsSummary(req.user._id, req.query.range);
  res.status(200).json({ success: true, data });
}, "getOverallSummary");

export const getOverallTimeseries = tryCatch(async (req, res, next) => {
  const data = await getOverallAnalyticsTimeseries(
    req.user._id,
    req.query.range,
  );
  res.status(200).json({ success: true, data });
}, "getOverallTimeseries");

export const getOverallBreakdown = tryCatch(async (req, res, next) => {
  const data = await getOverallAnalyticsBreakdown(
    req.user._id,
    req.query.range,
    req.query.by,
  );
  res.status(200).json({ success: true, data });
}, "getOverallBreakdown");

export const getOverallLeaderboard = tryCatch(async (req, res, next) => {
  const limit = Number(req.query.limit) || 10;
  const data = await getOverallAnalyticsLeaderboard(
    req.user._id,
    req.query.range,
    limit,
  );
  res.status(200).json({ success: true, data });
}, "getOverallLeaderboard");
