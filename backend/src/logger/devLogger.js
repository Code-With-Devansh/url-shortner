import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    target:'pino-pretty',
    options:{colorize:true}
  },
  redact: {
    paths: ["req.headers.authorization", "*.password", "*.token"],
    censor: "[REDACTED]",
  },
});

export default logger