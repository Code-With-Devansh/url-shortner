import pinoHttp from "pino-http";
import logger from "../logger/index.js";

export const requestLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/api/health" },
  customLogLevel(req, res, err) {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
