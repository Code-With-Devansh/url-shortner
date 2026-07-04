// utils/errorCodes.js
// Mirrors the `code` values documented in API.md → Error Codes.
// Keep this in sync with the backend if new codes are added.

export const ErrorCodes = {
  // Generic
  INTERNAL_ERROR: "INTERNAL_ERROR",
  VALIDATION_FAILED: "VALIDATION_FAILED",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",
  RATE_LIMITED_LOGIN: "RATE_LIMITED_LOGIN",
  RATE_LIMITED_REGISTER: "RATE_LIMITED_REGISTER",
  RATE_LIMITED_SHORTEN: "RATE_LIMITED_SHORTEN",
  RATE_LIMITED_REDIRECT: "RATE_LIMITED_REDIRECT",
  RATE_LIMITED_REFRESH: "RATE_LIMITED_REFRESH",
  RATE_LIMITED_EMAIL: "RATE_LIMITED_EMAIL",
  RATE_LIMITED_API: "RATE_LIMITED_API",

  // Auth
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_EMAIL_VERIFICATION_FAILED: "AUTH_EMAIL_VERIFICATION_FAILED",
  AUTH_USER_ALREADY_EXISTS: "AUTH_USER_ALREADY_EXISTS",
  AUTH_UNAUTHENTICATED: "AUTH_UNAUTHENTICATED",
  AUTH_USER_NOT_FOUND: "AUTH_USER_NOT_FOUND",

  // URL / redirect
  URL_NOT_FOUND: "URL_NOT_FOUND",
  URL_NOT_FOUND_OR_FORBIDDEN: "URL_NOT_FOUND_OR_FORBIDDEN",
  URL_INVALID_TARGET: "URL_INVALID_TARGET",
  CONFLICT: "CONFLICT",
  URL_GENERATION_FAILED: "URL_GENERATION_FAILED",

  // Analytics
  ANALYTICS_INVALID_RANGE: "ANALYTICS_INVALID_RANGE",
  ANALYTICS_INVALID_BREAKDOWN: "ANALYTICS_INVALID_BREAKDOWN",
};

// Fallback copy per code, used when a page doesn't want to special-case
// a code but still wants a friendlier message than the raw API message.
const DEFAULT_MESSAGES = {
  [ErrorCodes.INTERNAL_ERROR]: "Something went wrong on our end. Please try again.",
  [ErrorCodes.VALIDATION_FAILED]: "Please check the highlighted fields.",

  [ErrorCodes.RATE_LIMITED]: "You're doing that too much. Please slow down.",
  [ErrorCodes.RATE_LIMITED_LOGIN]: "Too many login attempts. Please try again later.",
  [ErrorCodes.RATE_LIMITED_REGISTER]: "Too many sign-up attempts from this network. Please try again later.",
  [ErrorCodes.RATE_LIMITED_SHORTEN]: "You're creating links too quickly. Please wait a moment.",
  [ErrorCodes.RATE_LIMITED_REDIRECT]: "Too many requests. Please slow down.",
  [ErrorCodes.RATE_LIMITED_REFRESH]: "Too many session refreshes. Please log in again.",
  [ErrorCodes.RATE_LIMITED_EMAIL]: "Too many emails requested. Please wait before trying again.",
  [ErrorCodes.RATE_LIMITED_API]: "You're doing that too much. Please slow down.",

  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: "Email or password is incorrect.",
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: "Please verify your email before logging in.",
  [ErrorCodes.AUTH_SESSION_EXPIRED]: "Your session has expired. Please log in again.",
  [ErrorCodes.AUTH_TOKEN_INVALID]: "This link is invalid or has expired.",
  [ErrorCodes.AUTH_EMAIL_VERIFICATION_FAILED]: "This verification link is invalid or has expired.",
  [ErrorCodes.AUTH_USER_ALREADY_EXISTS]: "An account with this email already exists.",
  [ErrorCodes.AUTH_UNAUTHENTICATED]: "Please log in to continue.",
  [ErrorCodes.AUTH_USER_NOT_FOUND]: "No account found for that email.",

  [ErrorCodes.URL_NOT_FOUND]: "That link doesn't exist.",
  [ErrorCodes.URL_NOT_FOUND_OR_FORBIDDEN]: "That link doesn't exist or isn't yours.",
  [ErrorCodes.URL_INVALID_TARGET]: "That destination URL isn't valid.",
  [ErrorCodes.CONFLICT]: "That custom slug is already taken.",
  [ErrorCodes.URL_GENERATION_FAILED]: "Couldn't generate a short link. Please try again.",

  [ErrorCodes.ANALYTICS_INVALID_RANGE]: "Invalid date range.",
  [ErrorCodes.ANALYTICS_INVALID_BREAKDOWN]: "Invalid breakdown option.",
};

/**
 * Normalizes any error thrown from an axiosInstance call (or a plain Error)
 * into a consistent shape the UI can branch on.
 *
 * Relies on utils/axiosInstance.js's response interceptor having already
 * attached `apiCode`, `fieldErrors`, and `userMessage` to the error object.
 */
export const parseApiError = (err) => {
  const code = err?.apiCode ?? null;
  const fieldErrors = err?.fieldErrors ?? null;
  const status = err?.response?.status ?? null;
  const message =
    (code && DEFAULT_MESSAGES[code]) ||
    err?.userMessage ||
    err?.message ||
    "Something went wrong. Please try again.";

  return { code, status, fieldErrors, message };
};

/** Convenience: does this error carry a specific API error code? */
export const isErrorCode = (err, code) => err?.apiCode === code;
