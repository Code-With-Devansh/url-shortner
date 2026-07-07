import pinoHttp from "pino-http";
import logger from "../logger/index.js";
import crypto from "crypto";

const { randomUUID } = crypto;
export const requestLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/api/health" || req.url === "/api/metrics" },
  genReqId: (req, res) => {
    const existingId = req.id ?? req.headers["x-request-id"];
    if (existingId) return existingId;
    const id = randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customLogLevel(req, res, err) {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
