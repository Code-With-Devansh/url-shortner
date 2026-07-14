# Snip

A full-stack URL shortener, built as a backend-focused portfolio project. Snip isn't just "generate a short code and redirect" — it's an exercise in the operational concerns that come with running a public redirect service at scale: caching, rate limiting, background job queues, pre-aggregated analytics, and hardened auth, all backed by real production infrastructure.

- **Backend**: `pixel-mart.in`
- **Frontend**: `snpi.vercel.app`

## Why This Project Exists

Most URL shortener tutorials stop at "hash the URL, save it, redirect." Snip is deliberately built to go further — it's a vehicle for demonstrating the kind of backend engineering that doesn't show up in a CRUD demo: what happens when a link goes viral and the redirect path needs to survive a traffic spike, how you keep analytics accurate without hammering the database on every click, what a defensible authentication system actually looks like end to end, and how you reason about trade-offs (staleness vs. cost, availability vs. strict correctness) instead of pretending they don't exist.

## Documentation

This README is the entry point. Deeper documentation lives in [`docs/`](./docs), written directly from the source rather than as an aspirational spec:

| Doc | Covers |
|---|---|
| [`SECURITY.md`](./docs/SECURITY.md) | Auth flow, token handling, rate limiting, redirect-path hardening, and a candid list of what isn't covered yet |
| [`DATABASE.md`](./docs/DATABASE.md) | MongoDB schemas/indexes, the Redis key map, the caching layer, and the HyperLogLog unique-visitor pipeline |
| [`ANALYTICS.md`](./docs/ANALYTICS.md) | The click → queue → Redis → MongoDB analytics pipeline, the API surface, and its accuracy/staleness guarantees |
| [`DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Docker architecture, environment variables, scheduled jobs, health checks, and logging |
| [`CONTRIBUTING.md`](./docs/CONTRIBUTING.md) | Code conventions, layering rules, and how to add a new endpoint consistently |

If you only read one of these, make it `SECURITY.md` before touching auth or the redirect path, and `ANALYTICS.md` before touching anything click-related — both explain *why* the code is shaped the way it is, not just what it does.

## Features

**Core**
- Shorten a URL, with optional custom slugs for authenticated users
- Fast redirects, hardened against cache stampedes and open-redirect payloads
- Anonymous link creation (rate-limited tighter than authenticated usage) and full account-based link management

**Auth**
- Dual-token JWT (short-lived access token, long-lived rotating refresh token), multi-device sessions, reuse-detection that revokes everything on a replayed token
- argon2id password hashing with a server-side pepper
- Email verification and password reset, both enumeration-safe (no "this email doesn't exist" leakage)

**Analytics**
- Per-URL and account-wide click summaries, timeseries, and breakdowns (country, device, browser, OS, referrer, hour)
- Pre-aggregated MongoDB storage (one document per URL per day) instead of one row per click
- HyperLogLog-based unique-visitor counting, with true cross-day/cross-URL merging via `PFMERGE` rather than summing per-day estimates
- A minute-bucketed Redis write buffer that keeps live analytics within roughly 1–2 minutes of real time without risking data loss on flush

**Infrastructure**
- Redis-backed rate limiting (per-route, consistent across replicas) and in-process load shedding under burst traffic
- A Bloom filter on the redirect hot path to cheaply reject requests for slugs that never existed
- BullMQ-driven background processing for click analytics and transactional email
- Structured JSON logging, request-ID correlation, and graceful shutdown for clean rolling deploys

See [`SECURITY.md`](./docs/SECURITY.md), [`DATABASE.md`](./docs/DATABASE.md), and [`ANALYTICS.md`](./docs/ANALYTICS.md) for the reasoning behind each of these, not just the feature list.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, Express 5 |
| Database | MongoDB (Atlas), Mongoose |
| Cache / Queues | Redis Stack (RedisBloom, HyperLogLog), BullMQ |
| Auth | `jose` (JWT), `argon2` (password hashing) |
| Validation | Zod |
| Logging | Pino (shipped via Vector → Axiom in production) |
| Email | Resend |
| Infrastructure | Docker, Docker Compose, nginx (host-level, not containerized) |

Full rationale for each of these — why Redis Stack specifically, why a dual-token JWT scheme, why pre-aggregated analytics instead of per-click rows — is in the linked docs above, not repeated here.

## Getting Started

```bash
git clone <this-repo>
cd backend
docker compose -f docker-compose.dev.yml up --build
```

This starts the API with hot-reload (bind-mounted source, `nodemon`) plus a local Redis Stack instance. You'll need a `.env` file with, at minimum, a MongoDB connection string and a Resend API key — see [`DEPLOYMENT.md`](./docs/DEPLOYMENT.md#environment-variables) for the full list of variables and what each one does. Rate limiting is automatically disabled in this mode, so you can iterate without tripping any limiters.

For running the API, workers, or scheduled jobs individually outside Docker, and for the full production Compose stack, see [`DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Project Structure

```
app.js / server.js        Express app + process entrypoint (routing, graceful shutdown)
src/
  routes/ controller/       HTTP layer
  services/                 Business logic
  dao/                      MongoDB access
  cache/                    Redis access (caching, rate limiting, Bloom filter, analytics buffer)
  models/ schema/           Mongoose schemas + Zod validation
  workers/ cron/             BullMQ consumers + scheduled flush jobs
docs/                       Architecture documentation (see table above)
```

Full layering conventions — what belongs in a controller vs. a service vs. a DAO, and a worked example of adding a new endpoint — are in [`CONTRIBUTING.md`](./docs/CONTRIBUTING.md).

## Status & Known Limitations

This is an actively developed portfolio project, not a finished product — the docs above are written to be honest about that rather than to oversell it. A few things worth knowing going in:

- **No test suite or CI pipeline yet.** See [`CONTRIBUTING.md`](./docs/CONTRIBUTING.md#what-this-repo-doesnt-have-yet).
- **Geolocation is currently a hardcoded stub** in the click-analytics pipeline (every click attributes to the same country) — see [`ANALYTICS.md`](./docs/ANALYTICS.md#known-gaps--accepted-risk).
- **No CSRF token scheme or account lockout** beyond rate limiting — deliberate trade-offs discussed in [`SECURITY.md`](./docs/SECURITY.md#known-gaps--accepted-risk), not oversights.
- Each doc in `docs/` ends with its own "Known Gaps / Accepted Risk" section — read those before assuming a given area is fully hardened.

## License

MIT — see `package.json`.
