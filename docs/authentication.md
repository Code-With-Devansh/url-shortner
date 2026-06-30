# Authentication

Snip uses a dual-token JWT scheme: a short-lived access token the client holds in memory and sends as a header, and a longer-lived refresh token stored in an `httpOnly` cookie that the server rotates on every use. Sessions are tracked per device, not just per user, so logging in on a phone and a laptop doesn't invalidate either one — but a stolen-and-replayed refresh token nukes every device's session at once.

## Tokens at a glance

| Token | Lifetime | Where it lives | Signed with |
|---|---|---|---|
| Access token | 15 minutes | `Authorization: Bearer <token>` header, held client-side (not a cookie) | `JWT_SECRET` |
| Refresh token | 20 days | `httpOnly` cookie (`refreshToken`) | `JWT_REFRESH_SECRET` |
| Device ID | 1 year | `httpOnly` cookie (`deviceId`), a `crypto.randomUUID()` set on first login | — (not a JWT, just an opaque identifier) |

Both JWTs are HS256, signed via [`jose`](https://github.com/panva/jose), with **separate secrets** for access and refresh — so a leaked `JWT_SECRET` can't be used to forge a long-lived refresh token, and vice versa.

The access token is deliberately **not** a cookie. It's returned in the JSON response body on login/refresh and the frontend is responsible for attaching it as a Bearer header on subsequent requests. Only the refresh token and device ID travel as cookies, since those are the only two values that need to survive a page reload without the frontend doing anything.

## Password storage

Passwords are hashed with **argon2id** (not bcrypt), with a server-side pepper (`PASSWORD_PEPPER`) appended to the password before hashing, on top of argon2's own per-hash salt. The pepper lives in environment config, not the database — so a database dump alone isn't enough to brute-force the hashes even if argon2id is later compromised at the algorithm level; the attacker also needs the pepper.

## Device sessions

Every browser/app instance gets a `deviceId` cookie the first time it logs in (a random UUID, 1-year expiry). From then on, that device's refresh-token session is tracked as its own row, keyed by `(userId, deviceId)` — not just `userId`. This is what makes multi-device login work correctly: refreshing on your phone rotates *that device's* token without touching your laptop's session.

Each `(userId, deviceId)` pair maps to exactly one active `RefreshToken` document (enforced by a unique compound index), upserted on login/refresh/verification rather than appending new rows — so a device always has at most one valid session, and logging in again on the same device just replaces it.

## Where sessions are stored

Sessions exist in two places that are kept in sync:

- **MongoDB** (`RefreshToken` collection) — the source of truth. Stores a SHA-256 hash of the refresh token (never the raw token), plus `deviceInfo` (deviceId, IP, user agent, last-seen timestamp) and an `expiresAt` field with a TTL index so Mongo garbage-collects expired sessions automatically.
- **Redis** — a fast-path cache mirroring the same `(userId, deviceId) → tokenHash` mapping, under `refresh:<userId>:<deviceId>`, with a parallel `user_sessions:<userId>` Redis *set* listing every session key that user currently has cached. That index set is what lets a full-logout-everywhere operation delete all of a user's cached sessions in one round trip instead of having to guess or scan for them.

On refresh, the server checks Redis first and only falls through to MongoDB on a cache miss — keeping the common case (a valid, recently-used session) off the database entirely.

## Login

```
POST /auth/login
  → validate email/password shape
  → read deviceId cookie (generate one via crypto.randomUUID() if absent — new device)
  → look up user, verify password with argon2
  → if user.isVerified is false → 401 AUTH_EMAIL_NOT_VERIFIED, no tokens issued
  → otherwise: issue access + refresh token
  → store refresh token (Redis cache + MongoDB upsert), keyed to this device
  → set deviceId cookie (if new) and refreshToken cookie
  → return { user, accessToken } in the response body
```

Unverified users can authenticate (correct password) but get no tokens — the controller explicitly returns `accessToken: null` from the service layer and the route layer turns that into a 401, rather than letting an unverified account hold a session.

## Refresh and rotation

`POST /auth/refresh` is where most of the interesting logic lives: every refresh **rotates** the token (old one deleted, brand new one issued) rather than just re-validating the same token repeatedly. This bounds how long a stolen refresh token stays useful — at most until its next legitimate use, after which it's already been swapped out.

The flow also doubles as reuse detection: if a refresh token is ever presented that *doesn't* match what's currently stored for that `(userId, deviceId)`, the server treats it as a signal that an old, already-rotated-out token has resurfaced — which only happens if someone other than the legitimate device captured a token at some point — and responds by deleting every session for that user, across every device, not just the one in this request.

That's the asymmetry worth understanding: rotation is scoped to one device, but reuse detection's response is scoped to the whole user. A compromise on one device's token is treated as a compromise of the account, not just that device.

Both layers (Redis and MongoDB) are wiped together via `delAllCachedRefreshTokens` + `delAllRefreshTokens` so a forced logout can't be partially undone by a stale Redis entry surviving the MongoDB wipe (or vice versa).

## Logout

`POST /auth/logout` deletes only the calling device's session (both Redis and MongoDB) and clears the `refreshToken` cookie. It does not touch the `deviceId` cookie or other devices' sessions — logging out on one device doesn't sign you out everywhere. If the request arrives with no refresh token or device ID at all, it short-circuits to a success response rather than erroring, since "already logged out" isn't a failure case.

## Email verification

New accounts start with `isVerified: false` and can't get tokens from `/auth/login` until that flips. Verification works like this:

```
POST /auth/send-verification-link        (rate-limited per email address)
  → generate a random 32-byte token, store its SHA-256 hash on the user doc
  → queue an email job (BullMQ) with the raw token
  → worker sends the email with a link containing the raw token

GET /auth/verify-email/:token
  → hash the incoming token, look up a user whose stored hash matches
  → mark isVerified = true
  → publish a "verified" event over Redis Pub/Sub for this userId
  → redirect the browser to the frontend's "email verified" page
```

The verification token itself follows the same pattern as refresh tokens: a random value is emailed to the user, but only its SHA-256 hash is ever persisted — so a database read alone can't be used to forge a working verification link.

### Live verification status via SSE

If the user verifies their email in a different tab or device than the one they registered from (a common pattern: open the link from a phone while the signup tab is still open on desktop), the original tab needs to find out *without polling*. `GET /auth/verify-status` holds an SSE connection open for exactly this — gated by a short-lived, single-use session token rather than the requester just naming an email address:

```
POST /auth/send-verification-link        (rate-limited per email address)
  → generate a random 32-byte sessionToken
  → look up the user; if none exists, or already verified, still return
    { message: "Verification Link Sent", sessionToken } — same shape either way
  → only if a real, unverified user was found: store SHA-256(sessionToken)
    in Redis as session:<hash> → userId, 10-minute TTL, queue the email

GET /auth/verify-status?token=<sessionToken>
  → hash the token, look up session:<hash> in Redis
  → no match → open an SSE stream anyway, but it's tied to nothing
    (heartbeats only; nothing will ever fire a "verified" event into it)
  → match → delete the session token (single-use), open an SSE stream,
    register this connection against the resolved userId
  → either way: send a heartbeat comment every 30s to keep
    intermediaries from timing the connection out
```

This closes off email enumeration at the source rather than by disguising the SSE response: a bogus or already-verified email never gets a token stored in Redis in the first place, so there's nothing for an attacker probing arbitrary addresses to present at `/verify-status` — the response from `send-verification-link` is identical regardless of whether the account exists, mirroring how `forgot-password` (below) already behaves. The token itself is short-lived (10 min), single-use (deleted on first successful lookup), and only ever compared by its SHA-256 hash, the same pattern used for refresh and password-reset tokens elsewhere in this doc.

Note that `sessionToken` is returned in the `send-verification-link` API response body itself, not only emailed — this is by design, so the calling tab can open its own `/verify-status` connection immediately rather than waiting on the user to click the emailed link first. It means possession of the token is scoped to "whoever made that API call" (normally the same browser tab that's about to listen for the SSE event), not "whoever has access to the inbox" the way the emailed verification link is.

`GET /auth/verify-status` is rate-limited by IP (20 requests / 5 min) — this is a long-lived connection, not a one-shot request, so the relevant risk is an attacker holding open many connections rather than spamming the endpoint with one-off calls.

When `verify-email` later succeeds, it publishes a `verified` event over the same Redis Pub/Sub channel (`sse:notify`) used elsewhere in the app for cross-replica fan-out — necessary because with two API replicas behind nginx, the SSE-holding request and the request that completes verification can easily land on different processes. Every replica subscribes to the channel; whichever one is actually holding that user's connection writes the event through, and the rest just no-op.

## Password reset

Mirrors the email-verification pattern almost exactly:

```
POST /auth/forgot-password                (rate-limited per email address)
  → look up user; if none exists, still return a generic success response
    (doesn't reveal whether the email has an account)
  → generate + store a hashed reset token, email the raw token

POST /auth/change-password/:token
  → hash incoming token, look up user with matching stored hash
  → if no match → 401 AUTH_TOKEN_INVALID
  → clear the reset token, update the password (re-hashed via argon2 on save)
```

`forgot-password` and `send-verification-link` now follow the same discipline: both return an identical response shape regardless of whether the target email has an account, so neither leaks account existence through response shape alone.

## Protecting routes

Two middleware functions read the same `Authorization: Bearer <token>` header but differ in what they do when it's missing or invalid:

- **`authMiddleware`** — used on routes that require a logged-in user (`GET /auth/me`, and others throughout the app). Missing or invalid token → `401 AUTH_UNAUTHENTICATED`, request never reaches the handler.
- **`attachUser`** — used on routes where auth is optional and just changes behavior (e.g. URL creation, where an authenticated user gets a higher rate limit and the new URL gets associated with their account). Populates `req.user` if a valid token is present; otherwise lets the request through unauthenticated, no error.

Both resolve the token the same way under the hood: verify the JWT signature and expiry, pull `userId` out of the payload, and look up the live user document — so a user deleted mid-session can't keep acting on a still-validly-signed access token for the remaining minutes of its lifetime.

## Refresh token rotation and reuse detection, end to end

```
Client → POST /auth/refresh (refreshToken cookie + deviceId cookie)
  ↓
Verify JWT signature/expiry on the refresh token
  ↓
Does the stored token for (userId, deviceId) match what was presented?
  ├─ yes → delete old token, issue + store a new one (this device only)
  │        → respond with a new access token, set new refreshToken cookie
  │
  └─ no  → delete EVERY session for this user, all devices
           (both Redis cache and MongoDB)
           → 401 AUTH_SESSION_EXPIRED, client must log in again everywhere
```

## Cookie configuration

| Setting | Dev | Production |
|---|---|---|
| `secure` | `false` | `true` |
| `sameSite` | `"lax"` | `"none"` |
| `httpOnly` | `true` | `true` |

Production uses `sameSite: "none"` because the frontend (Vercel) and backend (EC2) are on different origins — `lax` would silently drop the cookie on cross-origin requests. `secure: true` is required alongside `sameSite: "none"` by the cookie spec, which is also why dev (typically `http://localhost`) uses `lax` instead. See [`security.md`](./security.md) for the matching CORS configuration this depends on.

## Rate limits on auth routes

| Route | Window | Limit | Keyed by |
|---|---|---|---|
| `/auth/login` | 15 min | 10 | IP + email (lowercased) |
| `/auth/register` | 1 hour | 5 | IP |
| `/auth/refresh` | 5 min | 20 | IP + deviceId |
| `/auth/send-verification-link`, `/auth/forgot-password` | 1 hour | 4 | target email address |
| `/auth/verify-status` | 5 min | 20 | IP |

Login is keyed by **IP + email together** deliberately: IP-only would let an attacker spread credential stuffing across many target emails from one IP and only trip the limit once total; email-only would let a botnet rotate IPs and never trip it. The email-sending endpoints are keyed by the *target* email rather than the requester's IP, since otherwise anyone could email-bomb a victim with verification or reset emails from a botnet of IPs that never individually cross the limit. Full rationale and the rest of the app's rate limits are in [`security.md`](./security.md).

## Cross-site request forgery (CSRF) exposure

The cookie-authenticated surface is intentionally small: of every route in the app, only `/auth/refresh` and `/auth/logout` read the `refreshToken`/`deviceId` cookies at all. Everything else — analytics, URL creation/deletion, `GET /auth/me` — authenticates via the `Authorization: Bearer` header, which a cross-site request can't attach automatically the way a cookie rides along on its own. So the real CSRF question for this app is narrow: what can a forged request to those two routes actually accomplish, given there's no dedicated anti-CSRF token and `sameSite` is the only structural defense?

Worked through for each route:

- **`/auth/logout`** — a forged request logs the victim out of the one device whose cookies the browser sends. The response body carries nothing sensitive, and CORS prevents the attacker's page from reading it even if it could. Worst case: the victim is logged out of that device.
- **`/auth/refresh`** — a forged request causes the server to rotate that device's refresh token: a new one is issued, stored, and set as the victim's own cookie. The response body does contain a fresh access token, but CORS blocks an attacker's page from reading a credentialed cross-origin response unless this app's CORS config explicitly allows that origin — which it doesn't for arbitrary attacker origins. So the attacker can trigger the rotation but can't read what comes back. If reuse detection happens to trip during this (e.g. the victim's legitimate client races the forged request), the failure mode is every device session getting wiped, not anything narrower.

In both cases the attacker ends a session or forces a rotation; they don't obtain a token, a credential, or any access of their own. The exposure here is forced logout / forced session rotation, not account takeover — which is why `sameSite` alone is treated as adequate for this codebase's current routes rather than adding a dedicated CSRF token on top. That calculus would need revisiting if a future cookie-authenticated route ever returns something more sensitive, or performs a state change with consequences beyond the session itself (e.g. changing account email/password without re-authentication).

## Where to go next

- Endpoint-level request/response shapes: [`api.md`](./api.md)
- Rate limiting, CORS, and the rest of the security posture: [`security.md`](./security.md)
- `RefreshToken`/`User` schema and indexes: [`database.md`](./database.md)
- How this fits into the rest of the system: [`architecture.md`](./architecture.md)
