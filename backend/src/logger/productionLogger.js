import pkg from "../../package.json" with { type: "json" };
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.SERVICE_NAME || "api",
    env: process.env.NODE_ENV,
    version: pkg.version,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "**.password",
      "**.token",
      "**.secret",
      "**.apiKey",
    ],
    censor: "[REDACTED]",
  },
});

export default logger;