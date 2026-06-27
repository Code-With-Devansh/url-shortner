// Every operational error carries a stable, machine-readable `code` string
// (e.g. "AUTH_EMAIL_NOT_VERIFIED") in addition to the HTTP status.
// Convention: SCREAMING_SNAKE_CASE, namespaced by domain prefix
// (AUTH_*, VALIDATION_*, URL_*, ANALYTICS_*, SERVER_*).
class AppError extends Error {
  constructor(message, statusCode, code = "INTERNAL_ERROR") {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// errors must be a field->message object (from generateValidationErrors).
// If a plain string is ever passed here, that's a bug at the call site -
// fail loudly in dev rather than silently shipping a malformed `errors` field.
class ValidationError extends AppError {
  constructor(errors, code = "VALIDATION_FAILED") {
    super("Validation failed", 400, code);
    this.name = "ValidationError";
    if (typeof errors === "string") {
      if (process.env.NODE_ENV !== "production") {
        throw new TypeError(
          `ValidationError expects a field->message object, got a string: "${errors}". Use a specific AppError subclass with a proper code instead.`,
        );
      }
      this.errors = { _error: errors };
    } else {
      this.errors = errors;
    }
  }
}


class NotFoundError extends AppError {
  constructor(message, code = "NOT_FOUND") {
    super(message, 404, code);
    this.name = "NotFoundError";
  }
}

class UnauthorizedError extends AppError {
  constructor(message, code = "UNAUTHORIZED") {
    super(message, 401, code);
    this.name = "UnauthorizedError";
  }
}


class ForbiddenError extends AppError {
  constructor(message, code = "FORBIDDEN") {
    super(message, 403, code);
    this.name = "ForbiddenError";
  }
}


class conflictError extends AppError {
  constructor(message, code = "CONFLICT") {
    super(message, 409, code);
    this.name = "conflictError";
  }
}


class TooManyRequestsError extends AppError {
  constructor(message, code = "RATE_LIMITED") {
    super(message, 429, code);
    this.name = "TooManyRequestsError";
  }
}


export {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  conflictError,
  TooManyRequestsError,
};
