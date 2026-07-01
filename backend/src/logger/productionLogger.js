import pkg from "../../package.json" with { type: "json" };
import pino from "pino";
import config from "../config";

const logger = pino({
  level: config.logging.level || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "api",
    env: config.app.env,
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