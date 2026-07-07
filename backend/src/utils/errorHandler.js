import logger from "../logger/index.js";
import { AppError, ValidationError } from "./appError.js";

export const errorHandler = (err, req, res, next) => {

  const requestId = req.id;

  if (err instanceof ValidationError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      code: err.code,
      message: err.message,
      errors: err.errors,
      requestId,
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { err, url: req.url, method: req.method, code: err.code, requestId },
        "Operational server error",
      );
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      code: err.code,
      message: err.message,
      requestId,
    });
  }
  
  logger.error(
    { err, url: req.url, method: req.method, stack: err.stack, requestId },
    "Unhandled error",
  );
  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: err.message || "An unexpected error occurred",
    requestId,
  });
};
