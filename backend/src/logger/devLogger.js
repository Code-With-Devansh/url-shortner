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
    {
      target: "@axiomhq/pino",
      options: {
        dataset: process.env.AXIOM_DATASET,
        token: process.env.AXIOM_TOKEN,
      },
    },
  ]}),
);

export default logger;
