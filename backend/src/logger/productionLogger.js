import pino from "pino";

const hasAxiom = !!(process.env.AXIOM_DATASET && process.env.AXIOM_TOKEN);

const transport = hasAxiom
  ? pino.transport({
      targets: [
        {
          target: "pino/file",
          options: { destination: 1 }, 
        },
        {
          target: "@axiomhq/pino",
          options: {
            dataset: process.env.AXIOM_DATASET,
            token: process.env.AXIOM_TOKEN,
          },
        },
      ],
      worker: { autoEnd: true },
    })
  : pino.destination(1);

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: process.env.SERVICE_NAME || "api",
      env: process.env.NODE_ENV,
      version: process.env.npm_package_version,
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
  },
  transport,
);

const closeLogger = async () => {
  await Promise.race([
    new Promise((resolve) => logger.flush(resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
};
process.on("SIGTERM", closeLogger);
process.on("SIGINT", closeLogger);
process.on("uncaughtException", (err) => {
  logger.fatal(err, "Uncaught exception");
});

process.on("unhandledRejection", (err) => {
  logger.fatal(err, "Unhandled rejection");
});

export default logger;