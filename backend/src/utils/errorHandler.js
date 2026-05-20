import logger from "../logger/index.js";
import { AppError, ValidationError } from "./appError.js";
export const errorHandler = (err, req, res, next) => {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { err, url: req.url, method: req.method },
        "Operational server error",
      );
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }

  logger.error(
    { err, url: req.url, method: req.method, stack: err.stack },
    "Unhandled error",
  );
  res.status(500).json({
    success: false,
    message: err.message || "An unexpected error occurred",
  });
};
