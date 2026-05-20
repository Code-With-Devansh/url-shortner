// utils/tryCatch.js

import logger from "../logger/index.js";
import { AppError } from "./appError.js";

const tryCatch = (controller, fnName = "unknown") => {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      const isClientError = error instanceof AppError && error.statusCode < 500;
      if (!isClientError) {
        logger.error({ err: error, fn: fnName }, "Unexpected server error");
      }
      next(error);
    }
  };
};

export default tryCatch;
