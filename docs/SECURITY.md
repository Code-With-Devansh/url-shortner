# Security

This doc covers the security posture that isn't already owned by [`authentication.md`](./AUTHENTICATION.md): request-level hardening (CORS, headers, rate limiting as a whole matrix rather than per-route), the redirect path's defenses, and an honest list of what isn't covered yet. Token handling, password storage, session rotation, and reuse detection live in `authentication.md` — this doc links to that one rather than repeating it.

## Transport and headers

- **`helmet()`** is applied globally, right after the concurrency limiter and before body parsing, giving the app Express's standard set of hardened response headers (`X-Content-Type-Options`, a conservative `Content-Security-Policy` default, `X-Frame-Options`, etc.) without custom configuration.
- **`trust proxy` is set to `1`**, since the app sits behind nginx on a single EC2 VPS. This is what makes `req.ip` reflect the real client IP (via `X-Forwarded-For`) rather than nginx's own address — every IP-keyed rate limiter in the app depends on this being correct.
- **CORS is a single allowed origin**, not a wildcard: `cors({ origin: config.app.corsOrigin, credentials: true })`, where `APP_URL_CORS` is expected to exactly match the frontend's origin (see [`deployment.md`](./DEPLOYMENT.md#environment-variables)). `credentials: true` is required because the refresh-token and device-ID cookies need to ride along on cross-origin requests from the Vercel-hosted frontend — but that only works because the origin is pinned to one exact value, not reflected from the request.

## CORS and cookies together

Production runs the frontend (`snpi.vercel.app`) and backend (`pixel-mart.in`) on different origins, which is why the cookie config in [`authentication.md`](./AUTHENTICATION.md#cookie-configuration) uses `sameSite: "none"; secure: true` in production rather than the `lax` default — `lax` would silently drop the refresh/device cookies on every cross-origin request the frontend makes. Locally, both typically run on `localhost` origins, so `sameSite: "lax"` and `secure: false` are used instead, matching how a browser actually treats `http://localhost`.

## Rate limiting, as a whole matrix

Every limiter is Redis-backed (`rate-limit-redis`, `RedisStore`), so the limits hold consistently across both API replicas rather than each replica keeping its own counter. All limiters are skipped entirely when `NODE_ENV=development` (`skip: skipInDev`), which trades local iteration speed for the risk described below.

| Route(s) | Window | Limit | Keyed by | Why this key |
|---|---|---|---|---|
| `POST /auth/login` | 15 min | 10 | IP + email (lowercased) | IP-only lets an attacker spread credential stuffing across many emails from one IP; email-only lets a botnet rotate IPs. Combining both catches both shapes. |
| `POST /auth/register` | 1 hour | 5 | IP | Caps bulk account creation from one source. |
| `POST /auth/refresh` | 5 min | 20 | IP + `deviceId` | Each call does multiple Redis ops plus a Mongo write; a reuse-detection loop or a buggy client retry storm can hammer this harder than login itself. |
| `POST /auth/send-verification-link`, `POST /auth/forgot-password` | 1 hour | 4 | target email address | Keyed by the *recipient*, not the requester's IP — otherwise anyone could email-bomb a victim from a rotating pool of IPs that never individually trip the limit. |
| `GET /auth/verify-status` (SSE) | 5 min | 20 | IP | This is a long-lived connection, not a one-shot call — the risk is an attacker holding open many connections, not spamming requests. |
| `POST /auth/claim-session` | 3 min | 1 | (default: IP) | Deliberately tight — this endpoint claims a one-time session token, so more than one attempt in the window is already an anomaly. |
| URL shortening (authenticated) | 1 min | 10 | `user.id` | Normal product usage by a verified account. |
| URL shortening (anonymous) | 1 min | 5 | IP (default) | Anonymous creation is the classic spam/disposable-redirect-link vector, so it's capped tighter than authenticated usage. |
| Authenticated API backstop (analytics, user URLs) | 1 min | 100 | `user.id`, falling back to IP | Low abuse risk behind a valid access token, but still a backstop against a buggy frontend retry loop or a scraping script using a leaked token. |
| `GET /:shortId` (redirect) | — | 30 burst, 5/sec refill | IP | A Lua-scripted **token bucket**, not a fixed window — sized to absorb one link going viral without punishing legitimate burst traffic the way a fixed window would. See [`architecture.md`](./ARCHITECTURE.md#redirect-hot-path). |

Full request/response shapes for each endpoint are in [`api.md`](./API.md); the reasoning behind the auth-specific keys is repeated in more depth in [`authentication.md`](./AUTHENTICATION.md#rate-limits-on-auth-routes).

### Two load-shedding layers, not rate limits

Separately from the per-route limiters above, two layers protect the process itself rather than any one route:

- **`concurrencyLimiter`** — a global, deliberately *in-process* (not Redis-backed) counter capping in-flight requests per replica at 500. It protects this process's event loop and connection pool; since it's per-replica, the effective ceiling scales naturally with however many replicas are running, without any coordination.
- **`tokenBucketLimiter`** on the redirect route — see the table above.

### The `ipKeyGenerator` incident

Several of the IP-keyed limiters above were, until a fix, silently broken: `ipKeyGenerator` was called with the full Express `req` object instead of `req.ip`, which coerced to the literal string `"[object Object]"` and collapsed the IP dimension entirely for the `login`, `refresh`, and `api` limiters (and the IP-fallback branch of `email`). This shipped invisibly because `skip: skipInDev` means these code paths never execute in local development at all — "works in dev" was never evidence this logic was correct. Full incident writeup, including why it took four separate fixes rather than one, is in [`CHALLENGES-AND-TRADEOFFS.md`](./CHALLENGES-AND-TRADEOFFS.md#the-rate-limit-redis-key-corruption-bug).

## Redirect-path hardening

`GET /:shortId` is both the highest-traffic route and the one route that takes user-supplied data (the shortener's own past input) and sends a visitor's browser somewhere else — so it gets its own layered defenses on top of the token-bucket limiter above:

1. **Bloom filter pre-check** (`BF.EXISTS`) rejects slugs that definitely don't exist before any cache or database lookup runs. Probabilistic — can false-positive, never false-negatives — so it only ever short-circuits the safe case. See [`architecture.md`](./ARCHITECTURE.md#redirect-hot-path).
2. **Open-redirect protection at creation time**: `POST /api/create` validates `full_url` as a well-formed URL via Zod (`z.string().url()`), then separately rejects any submitted URL whose origin matches this service's own `BASE_URL` with a short-ID-shaped path — i.e. you can't use Snip to shorten a link that just points back at another Snip short link.
3. **Open-redirect protection at redirect time**: immediately before sending the visitor anywhere, `isValidRedirectUrl` re-parses the stored target and checks its protocol is in an explicit `http:`/`https:` allow-list. This runs again at redirect time — not just at creation time — so a target that was valid when shortened but is malformed or unparseable by the time it's read back still gets caught before use, rather than trusting a value written once and never re-checked.
4. **No raw 302.** Rather than redirecting directly, the server returns a small interstitial HTML page that shows the visitor the actual destination, counts down, and lets them cancel before navigating — a transparency/UX measure, not a substitute for the validation above. See [`architecture.md`](./ARCHITECTURE.md#redirect-hot-path) for why this doesn't block click recording.

## Enumeration resistance

Two account-adjacent endpoints are deliberately built to leak nothing about whether an email address has an account, mirroring each other's response shape exactly:

- `POST /auth/forgot-password` returns the same generic success response whether or not the email is registered.
- `POST /auth/send-verification-link` returns an identical `{ message, sessionToken }` shape regardless of whether the account exists or is already verified — and critically, only stores a real SSE session token in Redis when a genuine, unverified account was found, so there's nothing for an attacker probing arbitrary addresses to redeem at `/auth/verify-status` even though the response looks the same either way.

Full flow for both, including the SSE session-token handshake, is in [`authentication.md`](./AUTHENTICATION.md#email-verification).

## CSRF posture

There's no dedicated anti-CSRF token anywhere in the app. This is a deliberate, scoped trade-off rather than an oversight: only two routes in the entire app read cookies at all (`/auth/refresh`, `/auth/logout`) — everything else, including all analytics and URL-management endpoints, authenticates via an `Authorization: Bearer` header, which a cross-site request can't attach automatically the way a cookie does. Worked through per-route:

- **`/auth/logout`** — a forged request logs the victim's *current device* out. Nothing sensitive in the response, and CORS blocks the attacker's page from reading it regardless.
- **`/auth/refresh`** — a forged request forces that device's refresh token to rotate. The response does contain a fresh access token, but CORS prevents the attacker's origin from reading a credentialed cross-origin response, since `APP_URL_CORS` doesn't allow arbitrary origins. Worst case is a forced rotation the attacker can trigger but not observe — and if reuse detection happens to trip during the race, every session for that user gets wiped, not just the one device.

Net exposure: forced logout or forced session rotation, not account takeover or credential exposure — which is why `sameSite` plus a single pinned CORS origin is treated as sufficient here rather than adding a CSRF token on top. Full reasoning, worked example by example, is in [`authentication.md`](./AUTHENTICATION.md#cross-site-request-forgery-csrf-exposure). That calculus would need revisiting if a future cookie-authenticated route returns something more sensitive, or performs a state change with consequences beyond the session itself.

## Input validation

All request bodies that create or mutate data are validated with Zod before touching a service or DAO — URL shortening (`full_url`, optional custom `short_url` slug: letters/numbers/hyphens only, 3–50 chars) is the main example on the unauthenticated surface. Validation failures return a structured `ValidationError` rather than letting malformed input reach MongoDB queries or Redis keys.

## Known Gaps / Accepted Risk

Consistent with the rest of this repo's docs, this is a candid list, not a todo list with the uncomfortable parts omitted:

- **No CSRF token scheme.** Accepted per the analysis above; would need revisiting if a cookie-authenticated route's blast radius grows.
- **No account lockout beyond rate limiting.** `login` rate-limits to 10 attempts / 15 min per IP+email, but there's no separate lockout counter on the account itself — a distributed attacker spreading attempts across many IPs against one email is throttled less aggressively than the table above might suggest, since it's still ultimately bounded by the IP+email compound key.
- **No dedicated WAF or IP reputation layer.** All hardening on the redirect and auth paths is application-level (bloom filter, token bucket, Zod validation); there's no upstream filtering of known-bad IPs or request signatures.
- **Geolocation in click analytics is a hardcoded stub**, not a real IP-to-country lookup — see [`ANALYTICS.md`](./ANALYTICS.md#known-gaps--accepted-risk). Not a security issue on its own, but worth knowing if analytics data is ever used for anything trust-related.
- **`send-verification-link` is callable anonymously** with only an email address. The endpoint is enumeration-safe and rate-limited per target email. As a result, an attacker can trigger verification emails to arbitrary addresses and may cause an account to become verified if the recipient clicks the legitimate link. Because the verification endpoint only marks the account as verified and does not create an authenticated session or issue credentials, this does not enable account takeover. The primary remaining concern is unsolicited verification email generation, which may warrant additional abuse protections (for example, CAPTCHA, IP-based rate limiting, or requiring authentication before resending verification emails).
- **No automated security testing.** There's no test suite at all yet (see [`README.md`](./README.md#status--known-limitations)), so nothing here — rate limiter key generation included — is regression-tested; the `ipKeyGenerator` incident above is a direct consequence of that gap, not a one-off.
- **Rate limiters are fully skipped in development**, which is good for iteration speed but means anything gated behind `skip: skipInDev` is *unexercised*, not *verified*, until it runs in production. See the incident writeup above.

## Where to go next

- Token handling, password storage, session rotation, reuse detection: [`authentication.md`](./AUTHENTICATION.md)
- Incident history and the reasoning behind specific trade-offs: [`CHALLENGES-AND-TRADEOFFS.md`](./CHALLENGES-AND-TRADEOFFS.md)
- Redirect hot path and system-wide load-shedding: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Environment variables (`APP_URL_CORS`, `JWT_SECRET`, `PASSWORD_PEPPER`, etc.): [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- Endpoint-level request/response shapes: [`API.md`](./API.md)
