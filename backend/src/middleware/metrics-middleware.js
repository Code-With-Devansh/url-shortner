import { httpDuration, httpInFlight } from "../config/metrics.js";

export const metricsMiddleware = (req, res, next) => {
  const end = httpDuration.startTimer();
  httpInFlight.inc({ route: "in_flight" });

  res.on("finish", () => {
    const route = req.route?.path
      ? (req.baseUrl || "") + req.route.path
      : "unmatched";

    end({
      method: req.method,
      route,
      status: res.statusCode
    });
    httpInFlight.dec({ route: "in_flight" });
  });

  next();
};
