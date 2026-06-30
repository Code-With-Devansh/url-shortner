# Snip API Documentation

Base URL (production): `https://snp.2bd.net`

All request/response bodies are JSON unless noted otherwise. All endpoints are prefixed with `/api` except the redirect route itself, which lives at the root (`/:shortId`) since it has to work as a bare short link.

---

## Table of Contents

- [Authentication](#authentication)
- [Conventions](#conventions)
- [Error Codes](#error-codes)
- [Rate Limits](#rate-limits)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [URLs](#urls)
  - [User](#user)
  - [Analytics](#analytics)
  - [Redirect](#redirect)
  - [Health](#health)

---

## Authentication

Snip uses a dual-token scheme:

| Token             | Where it lives                                                                                    | Lifetime   | Purpose                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Access token**  | Returned in the JSON body on login/refresh; sent by the client as `Authorization: Bearer <token>` | 15 minutes | Authorizes requests to protected routes                                                                                  |
| **Refresh token** | `httpOnly` cookie (`refreshToken`)                                                                | 20 days    | Used to mint a new access token via `/api/auth/refresh`                                                                  |
| **Device ID**     | `httpOnly` cookie (`deviceId`)                                                                    | 1 year     | Identifies a browser/device so refresh tokens can be tracked and revoked per-device, independent of `User-Agent` strings |

Cookies are set with `sameSite: "none"` and `secure: true` (in production), since the frontend (`snpi.vercel.app`) and backend (`snp.2bd.net`) are on different origins. Requests that rely on cookies (`refresh`, `logout`) must be made with `credentials: "include"` (fetch) or `withCredentials: true` (Axios).

**Typical flow:**

1. `POST /api/auth/register` → creates an unverified account.
2. User verifies their email (link sent via email; see [`/verify-email/:token`](#get-apiauthverify-emailtoken)).
3. `POST /api/auth/login` → returns an access token in the body and sets the `refreshToken` + `deviceId` cookies.
4. Client attaches `Authorization: Bearer <accessToken>` to subsequent requests.
5. When the access token expires (15 min), the client calls `POST /api/auth/refresh` (cookies sent automatically) to get a new one.
6. If the refresh token is itself invalid, missing, or has been revoked (e.g. reused after rotation, or session cleared), the server returns `401 AUTH_SESSION_EXPIRED` — the client should treat this as "logged out" and redirect to login.

Some routes (like creating a short URL) work both **authenticated and anonymous** — see [`POST /api/create`](#post-apicreate).

---

## Conventions

**Success response shape** (uniform across all endpoints):

```json
{
  "success": true,
  "data": { ... },
  "message": "Human-readable description"
}
```

**Error response shape** (uniform across all endpoints):

```json
{
  "success": false,
  "code": "MACHINE_READABLE_CODE",
  "message": "Human-readable description",
  "errors": { "field": "Field-specific validation message" }
}
```

The `errors` field is only present on `400 VALIDATION_FAILED` responses where individual field errors apply.

---

## Error Codes

Every error response includes a stable `code` string the frontend can branch on, in addition to the HTTP status. Codes are namespaced by domain.

### Generic

| Code                | HTTP | Meaning                                                    |
| ------------------- | ---- | ---------------------------------------------------------- |
| `INTERNAL_ERROR`    | 500  | Unhandled/unexpected error                                 |
| `VALIDATION_FAILED` | 400  | Request body/query failed schema validation — see `errors` |

### Rate limiting

| Code                    | HTTP | Meaning                                                                |
| ----------------------- | ---- | ---------------------------------------------------------------------- |
| `RATE_LIMITED`          | 429  | Generic rate limit                                                     |
| `RATE_LIMITED_LOGIN`    | 429  | Too many login attempts (per IP + email)                               |
| `RATE_LIMITED_REGISTER` | 429  | Too many registration attempts (per IP)                                |
| `RATE_LIMITED_SHORTEN`  | 429  | Too many short URLs created                                            |
| `RATE_LIMITED_REDIRECT` | 429  | Too many redirect requests from this IP                                |
| `RATE_LIMITED_REFRESH`  | 429  | Too many token refresh attempts                                        |
| `RATE_LIMITED_EMAIL`    | 429  | Too many verification/password-reset emails requested for this address |
| `RATE_LIMITED_API`      | 429  | Generic backstop on authenticated routes                               |

### Auth

| Code                             | HTTP | Meaning                                                        |
| -------------------------------- | ---- | -------------------------------------------------------------- |
| `AUTH_INVALID_CREDENTIALS`       | 401  | Wrong email/password on login                                  |
| `AUTH_EMAIL_NOT_VERIFIED`        | 401  | Login attempted before email verification                      |
| `AUTH_SESSION_EXPIRED`           | 401  | Refresh token missing, invalid, or revoked — re-login required |
| `AUTH_TOKEN_INVALID`             | 400  | Password-reset token invalid or expired                        |
| `AUTH_EMAIL_VERIFICATION_FAILED` | 400  | Email verification link invalid or expired                     |
| `AUTH_USER_ALREADY_EXISTS`       | 409  | Registering with an email already in use                       |
| `AUTH_UNAUTHENTICATED`           | 401  | No or invalid access token on a protected route                |
| `AUTH_USER_NOT_FOUND`            | 404  | No account exists for the given email                          |

### URL / redirect

| Code                         | HTTP | Meaning                                                        |
| ---------------------------- | ---- | -------------------------------------------------------------- |
| `URL_NOT_FOUND`              | 404  | Short URL doesn't exist                                        |
| `URL_NOT_FOUND_OR_FORBIDDEN` | 404  | Delete/lookup target doesn't exist or isn't owned by this user |
| `URL_INVALID_TARGET`         | 400  | Destination URL isn't a valid `http(s)` URL                    |
| `CONFLICT` _(generic)_       | 409  | Custom slug already taken                                      |
| `URL_GENERATION_FAILED`      | 500  | Short ID generator failed to produce an ID                     |

### Analytics

| Code                          | HTTP | Meaning                                            |
| ----------------------------- | ---- | -------------------------------------------------- |
| `ANALYTICS_INVALID_RANGE`     | 400  | `range` query param not one of the allowed values  |
| `ANALYTICS_INVALID_BREAKDOWN` | 400  | `by` query param not one of the allowed dimensions |

---

## Rate Limits

All limits are disabled when `NODE_ENV=development`. In production:

| Endpoint(s)                                                 | Window                               | Limit | Keyed by      |
| ----------------------------------------------------------- | ------------------------------------ | ----- | ------------- |
| `POST /api/auth/login`                                      | 15 min                               | 10    | IP + email    |
| `POST /api/auth/register`                                   | 1 hour                               | 5     | IP            |
| `POST /api/auth/refresh`                                    | 5 min                                | 20    | IP + deviceId |
| `POST /api/auth/send-verification-link`, `/forgot-password` | 1 hour                               | 4     | target email  |
| `POST /api/create` (authenticated)                          | 1 min                                | 10    | user ID       |
| `POST /api/create` (anonymous)                              | 1 min                                | 5     | IP            |
| `GET /:shortId` (redirect)                                  | token bucket: burst 30, refill 5/sec | —     | IP            |
| All `/api/analytics/*`, `GET /api/user/urls`                | 1 min                                | 100   | user ID       |

Rate-limited responses return `429` with the relevant `RATE_LIMITED_*` code above and standard `RateLimit-*` headers.

---

## Endpoints

### Auth

All routes below are prefixed with `/api/auth`.

#### `POST /api/auth/register`

Create a new (unverified) account.

**Auth required:** No

**Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secret123"
}
```

| Field      | Rules                                               |
| ---------- | --------------------------------------------------- |
| `name`     | 3–50 chars, letters/spaces/apostrophes/hyphens only |
| `email`    | valid email                                         |
| `password` | 6–16 chars                                          |

**Success — `201`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "665f1b...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "avatar": null,
      "isVerified": false,
      "createdAt": "2026-06-20T10:00:00.000Z"
    }
  },
  "message": "User registered successfully"
}
```

**Errors:** `400 VALIDATION_FAILED`, `409 AUTH_USER_ALREADY_EXISTS`, `429 RATE_LIMITED_REGISTER`

---

#### `POST /api/auth/login`

Log in with email + password. Sets `refreshToken` and (if new) `deviceId` cookies on success.

**Auth required:** No

**Body:**

```json
{ "email": "jane@example.com", "password": "secret123" }
```

**Success — `200`:**

```json
{
  "success": true,
  "data": {
    "user":{
      "id": "665f1b...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "avatar": null,
      "isVerified": true,
      "createdAt": "2026-06-20T10:00:00.000Z",
    }
    "accessToken": "eyJhbGciOi..."
  },
  "message": "User logged in successfully"
}
```

**Errors:** `400 VALIDATION_FAILED`, `401 AUTH_INVALID_CREDENTIALS`, `401 AUTH_EMAIL_NOT_VERIFIED`, `429 RATE_LIMITED_LOGIN`

> Note: if the account exists, the password is correct, but the email isn't verified yet, login fails with `AUTH_EMAIL_NOT_VERIFIED` rather than issuing tokens.

---

#### `GET /api/auth/me`

Get the currently authenticated user.

**Auth required:** Yes (`Authorization: Bearer <accessToken>`)

**Success — `200`:**

```json
{
  "success": true,
  "data": {
    "id": "665f1b...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "avatar": null,
    "isVerified": true,
    "createdAt": "2026-06-20T10:00:00.000Z"
  },
  "message": "Current user fetched successfully"
}
```

**Errors:** `401 AUTH_UNAUTHENTICATED`

---

#### `POST /api/auth/refresh`

Exchange the `refreshToken` cookie for a new access token. Rotates the refresh token (issues a new one, invalidates the old one) and sets a new `refreshToken` cookie.

**Auth required:** No (requires `refreshToken` + `deviceId` cookies instead)

**Body:** none

**Success — `200`:**

```json
{
  "success": true,
  "message": "Access Token refreshed.",
  "data":{
    "accessToken": "eyJhbGciOi..."
  }
}
```

**Errors:** `401 AUTH_SESSION_EXPIRED` (missing/invalid/reused refresh token — client should force re-login), `429 RATE_LIMITED_REFRESH`

---

#### `POST /api/auth/logout`

Revoke the current device's refresh token and clear the `refreshToken` cookie.

**Auth required:** No (uses cookies if present; safe to call even if already logged out)

**Success — `200`:**

```json
{ "success": true, "message": "Logout successfully" }
```

---

#### `POST /api/auth/send-verification-link`

Request a new email-verification link.

**Auth required:** No

**Body:** `{ "email": "jane@example.com" }`

**Success — `200`:** Always returns the same message, regardless of whether the account exists or is already verified — this is intentional, to avoid leaking which emails are registered:

```json
{ 
  "success": true, 
  "message": "Verification Link Sent", 
  "data": {
    "sessionToken":"5a4f25df1fcca1ba1b..."
  } 
}
```

**Errors:** `400 VALIDATION_FAILED`, `429 RATE_LIMITED_EMAIL`

---

#### `GET /api/auth/verify-email/:token`

Verification link target (clicked from the emailed link, not typically called directly by a frontend client). On success, redirects to `${APP_URL}/auth/email-verified`.

**Auth required:** No

**Errors:** `400 AUTH_EMAIL_VERIFICATION_FAILED` (invalid/expired token)

---

#### `GET /api/auth/verify-status`

Server-Sent Events (SSE) stream that notifies the client the moment an account becomes verified — useful for a "check your email" screen that auto-advances without polling.

**Auth required:** No

**Query params:** `sessionToken` (required)

**Response:** `Content-Type: text/event-stream`. Sends a `verified` event ```{success:true}``` once verification completes; sends a heartbeat comment every 30s to keep the connection alive.

**Errors:** `401 AUTH_TOKEN_INVALID` (Invalid SessionToken)

---

#### `POST /api/auth/forgot-password`

Request a password-reset email.

**Auth required:** No

**Body:** `{ "email": "jane@example.com" }`

**Success — `200`:** Same anti-enumeration behavior as `send-verification-link` — always returns success:

```json
{ "success": true, "message": "Email sent successfully." }
```

**Errors:** `400 VALIDATION_FAILED`, `429 RATE_LIMITED_EMAIL`

---

#### `POST /api/auth/change-password/:token`

Set a new password using a valid password-reset token.

**Auth required:** No

**Body:** `{ "password": "newSecret123" }`

**Success — `200`:**

```json
{ "success": true, "message": "password updated successfully." }
```

**Errors:** `400 VALIDATION_FAILED`, `401 AUTH_TOKEN_INVALID`

---

### URLs

#### `POST /api/create`

Create a short URL. Works both **anonymously** and **authenticated** — behavior differs slightly:

- **Anonymous:** generates a random 7-character ID. Custom slugs are not allowed.
- **Authenticated:** generates a random ID, or uses a custom `slug` if provided. The URL is associated with the user's account (so it shows up in `GET /api/user/urls` and analytics).

**Auth required:** No (optional — send `Authorization` header if logged in to associate the link with your account)

**Body:**

```json
{
  "url": "https://example.com/some/long/path",
  "slug": "my-custom-slug"
}
```

| Field  | Required               | Rules                                                                    |
| ------ | ---------------------- | ------------------------------------------------------------------------ |
| `url`  | yes                    | must be a valid URL                                                      |
| `slug` | no, authenticated only | 3–50 chars, lowercase letters/numbers/hyphens only (e.g. `my-cool-link`) |

**Success — `200`:**

```json
{ 
  "short_id": "aB3xK9z",
  "short_url": "https://snp.2bd.net/aB3xK9z",
  "full_url":"https://example.com"
}
```

**Errors:** `400 VALIDATION_FAILED`, `409 CONFLICT` (slug already taken), `429 RATE_LIMITED_SHORTEN`

---

#### `DELETE /api/:id`

Delete a short URL you own.

**Auth required:** Yes

**Path params:** `id` — the short URL's slug/ID (not a Mongo `_id`)

**Success — `200`:**

```json
{ "success": true, "message": "Short URL deleted successfully" }
```

**Errors:** `401 AUTH_UNAUTHENTICATED`, `404 URL_NOT_FOUND_OR_FORBIDDEN` (doesn't exist, or belongs to someone else)

---

### User

#### `GET /api/user/urls`

List the authenticated user's short URLs. Cursor-paginated.

**Auth required:** Yes

**Query params:**
| Param | Default | Notes |
|---|---|---|
| `limit` | 30 | 10–100. Values outside this range fall back to the default or error (see note) |
| `sortBy` | `createdAt` | `createdAt` \| `clicks` |
| `order` | `desc` | `asc` \| `desc` |
| `cursor` | — | Opaque base64 string from a previous response's `pagination.nextCursor`. Omit for the first page. |
| `search` | — | Full-text search across the URL's stored fields |
| `isActive` | — | `true` \| `false`. Omit to return both |
| `expiryFilter` | — | `expired` \| `active`. Omit for all |

> The `cursor` is opaque and must be passed back exactly as received — don't construct or decode it client-side, the format isn't a stable contract.

**Success — `200`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "665f1b...",
      "full_url": "https://example.com/...",
      "shortCode": "aB3xK9z",
      "short_url": "https://snp.2bd.net/aB3xK9z",
      "clicks": 42,
      "isActive": true,
      "createdAt": "2026-06-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "eyJpZCI6Ii4uLiJ9",
    "limit": 30,
    "sortBy": "createdAt",
    "order": "desc"
  }
}
```

`nextCursor` is `null` when `hasMore` is `false` — that's your signal to stop paginating.

**Errors:** `401 AUTH_UNAUTHENTICATED`, `429 RATE_LIMITED_API`

---

### Analytics

All routes below are prefixed with `/api/analytics` and require authentication. Each accepts a `range` query param: `7d` | `30d` | `90d` (default `30d`).

#### Overall (across all of the user's URLs)

| Method & Path                    | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `GET /api/analytics/summary`     | Total clicks + unique visitors for the period |
| `GET /api/analytics/timeseries`  | Daily click counts for the period             |
| `GET /api/analytics/breakdown`   | Top values for a dimension (see `by` below)   |
| `GET /api/analytics/leaderboard` | Top-performing URLs by click count            |

#### Per-URL

| Method & Path                       | Description                                |
| ----------------------------------- | ------------------------------------------ |
| `GET /api/analytics/summary/:id`    | Total clicks + unique visitors for one URL |
| `GET /api/analytics/timeseries/:id` | Daily click counts for one URL             |
| `GET /api/analytics/breakdown/:id`  | Dimension breakdown for one URL            |

**`breakdown` endpoints additionally require `by`:** `countries` \| `devices` \| `browsers` \| `os` \| `referers` \| `hours`

**`leaderboard` additionally accepts:** `limit` (default 10, capped at 50)

**Example — `GET /api/analytics/summary/665f1b...?range=7d`:**

```json
{
  "success": true,
  "data": {
    "urlId": "665f1b...",
    "shortUrl": "aB3xK9z",
    "fullUrl": "https://example.com/...",
    "range": "7d",
    "total": 312,
    "uniqueVisitors": 198
  }
}
```

**Example — `GET /api/analytics/breakdown?by=countries&range=30d`:**

```json
{
  "success": true,
  "data": [
    { "name": "IN", "count": 120 },
    { "name": "US", "count": 87 }
  ]
}
```

**Example — `GET /api/analytics/leaderboard?range=30d&limit=5`:**

```json
{
  "success": true,
  "data": [
    {
      "urlId": "665f1b...",
      "shortUrl": "aB3xK9z",
      "fullUrl": "https://example.com/...",
      "clicks": 580
    }
  ]
}
```

> **Caveat worth knowing as a consumer of this API:** `uniqueVisitors` in multi-day responses (`summary`, `timeseries` over more than one day) is a sum of each day's unique-visitor count, not a true unique count across the whole range — someone visiting on two different days within the range is counted twice. Treat it as an upper bound, not an exact dedup.

**Errors:** `401 AUTH_UNAUTHENTICATED`, `404 URL_NOT_FOUND` (per-URL routes, if the URL doesn't exist or isn't yours), `400 ANALYTICS_INVALID_RANGE`, `400 ANALYTICS_INVALID_BREAKDOWN`, `429 RATE_LIMITED_API`

---

### Redirect

#### `GET /:shortId`

The actual short link redirect. This is what `https://snp.2bd.net/aB3xK9z` resolves to — not typically called by API consumers directly.

**Auth required:** No

**Behavior:** Serves an HTML interstitial page that redirects to the target URL client-side (rather than an HTTP 301/302) and records the click for analytics.

**Errors:** `404 URL_NOT_FOUND`, `400 URL_INVALID_TARGET` (target URL failed validation at redirect time), `429 RATE_LIMITED_REDIRECT` (token bucket: burst of 30, refilling at 5/sec, per IP)

---

### Health

#### `GET /api/health`

Liveness/readiness check.

**Auth required:** No

**Success — `200`:** `{ "success": true, "inFlight": 1 }`

**During graceful shutdown — `503`:** `{ "success": false, "status": "shutting_down" }`
