import pino from "pino";

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "debug",
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ["req.headers.authorization", "*.password", "*.token"],
      censor: "[REDACTED]",
    },
  },
  pino.transport({targets:[
    {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  ]}),
);

export default logger;
