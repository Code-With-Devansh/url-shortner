import { httpDuration } from "../config/metrics.js";

export const metricsMiddleware = (req, res, next) => {
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path
      ? (req.baseUrl || "") + req.route.path
      : "unmatched";
    end({
      method: req.method,
      route,
      status: res.statusCode
    });
  });

  next();
};
