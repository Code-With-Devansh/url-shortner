import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.token"],
    censor: "[REDACTED]",
  },
});

export default logger