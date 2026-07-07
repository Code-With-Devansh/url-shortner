import { httpDuration } from "../config/metrics.js";

export const metricsMiddleware = (req, res, next) => {
    const end = httpDuration.startTimer();

    res.on("finish", () => {
        end({
            method: req.method,
            route: req.route?.path || req.path,
            status: res.statusCode
        });
    });

    next();
};