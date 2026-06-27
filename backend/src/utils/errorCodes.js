// Single source of truth for every `code` value the API can return in an
// error response body: { success: false, code, message, errors? }.
//
// Keep this in sync with whatever the frontend uses to branch on errors
// (e.g. a matching TS union/enum). When adding a new error case in a
// controller/service, add the code here first, then throw it - don't
// invent ad-hoc strings at the call site.

export const ErrorCodes = {
  // --- Generic / fallback ---
   INTERNAL_ERROR: "INTERNAL_ERROR",       // 500 - unhandled/unexpected error
  VALIDATION_FAILED: "VALIDATION_FAILED", // 400 - generic zod validation failure (see `errors` field for per-field messages)
  RATE_LIMITED: "RATE_LIMITED",           // 429 - generic rate limit
  RATE_LIMITED_LOGIN: "RATE_LIMITED_LOGIN",       // 429 - too many login attempts (per IP+email)
  RATE_LIMITED_REGISTER: "RATE_LIMITED_REGISTER", // 429 - too many registration attempts (per IP)
  RATE_LIMITED_SHORTEN: "RATE_LIMITED_SHORTEN",   // 429 - too many short URLs created (per user, or per IP if anonymous)
  RATE_LIMITED_REDIRECT: "RATE_LIMITED_REDIRECT", // 429 - too many redirect requests from this IP (token bucket)
  RATE_LIMITED_REFRESH: "RATE_LIMITED_REFRESH",   // 429 - too many token refresh attempts (per IP+deviceId)
  RATE_LIMITED_EMAIL: "RATE_LIMITED_EMAIL",       // 429 - too many verification/password-reset emails requested for this address
  RATE_LIMITED_API: "RATE_LIMITED_API",           // 429 - generic backstop on authenticated routes (per user)
  // --- Auth ---
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS", // 401 - wrong email/password on login
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",   // 401 - login attempt before email verification
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",         // 401 - refresh token missing/invalid/reused -> force re-login
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",             // 400 - password-reset token invalid/expired
  AUTH_EMAIL_VERIFICATION_FAILED: "AUTH_EMAIL_VERIFICATION_FAILED", // 400 - verification link invalid/expired
  AUTH_USER_ALREADY_EXISTS: "AUTH_USER_ALREADY_EXISTS", // 409 - register with an email already in use
  AUTH_UNAUTHENTICATED: "AUTH_UNAUTHENTICATED",         // 401 - no/invalid access token on a protected route
  AUTH_USER_NOT_FOUND: "AUTH_USER_NOT_FOUND",           // 404 - no account exists for the given email (e.g. SSE verification-status lookup)

  // --- URL / redirect ---
  URL_NOT_FOUND: "URL_NOT_FOUND",                 // 404 - short URL doesn't exist (redirect or analytics lookup)
  URL_NOT_FOUND_OR_FORBIDDEN: "URL_NOT_FOUND_OR_FORBIDDEN", // 404 - delete/owner-scoped lookup that doesn't match this user
  URL_INVALID_TARGET: "URL_INVALID_TARGET",       // 400 - destination URL isn't a valid http(s) URL
  URL_SLUG_TAKEN: "URL_SLUG_TAKEN",               // 409 - custom slug already exists
  URL_GENERATION_FAILED: "URL_GENERATION_FAILED", // 500 - short id generator failed to produce an id

  // --- Analytics ---
  ANALYTICS_INVALID_RANGE: "ANALYTICS_INVALID_RANGE",         // 400 - `range` query param not in ALLOWED_RANGES
  ANALYTICS_INVALID_BREAKDOWN: "ANALYTICS_INVALID_BREAKDOWN", // 400 - `by` query param not in ALLOWED_BREAKDOWNS
};