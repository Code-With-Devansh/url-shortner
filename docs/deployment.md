# Deployment

This document describes how Snip's backend is built, configured, and run — from local development through to the production Docker Compose stack. It reflects the actual `Dockerfile*`/`docker-compose*.yml`/`docker/crontab` in this repo, not an idealized setup.

## Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Production Stack](#production-stack)
- [Docker Images](#docker-images)
- [Scheduled Jobs](#scheduled-jobs)
- [Health Checks & Graceful Shutdown](#health-checks--graceful-shutdown)
- [Logging](#logging)
- [Rebuilding the Bloom Filter](#rebuilding-the-bloom-filter)
- [Known Gaps / Accepted Risk](#known-gaps--accepted-risk)

---

## Architecture Overview

```
                        ┌────────────┐
   internet ──────────▶ │   nginx    │  (reverse proxy — external to this repo,
                        └─────┬──────┘   runs on the EC2 host, not containerized here)
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
           ┌───────────┐             ┌───────────┐
           │  server   │  :5000      │  server2  │  :5001
           │  (api)    │             │  (api)    │
           └─────┬─────┘             └─────┬─────┘
                 │                         │
                 └───────────┬─────────────┘
                              │
                    ┌─────────┴─────────┐
                    │       redis        │  (redis-stack-server — needed for
                    │  (cache/queue/     │   the Bloom filter module)
                    │   sessions/HLL)    │
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────────┐ ┌───────────┐
      │ worker-click │ │ worker-email │ │   cron    │
      │  (BullMQ)    │ │  (BullMQ)    │ │ (busybox  │
      └──────────────┘ └──────────────┘ │  crond)   │
                                          └───────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  MongoDB Atlas  │  (managed, external — not
                     └─────────────────┘   part of this compose stack)
```

- **`server` / `server2`** are two replicas of the same API image, each bound to a different host port (`5000`/`5001`), sitting behind nginx on the host. This is the mechanism by which the app scales horizontally — each replica has its own independent in-process rate/concurrency limiting (see [`SECURITY.md`](./SECURITY.md#load-shedding)) but shares state (sessions, cache, rate-limit counters) through the one Redis instance.
- **`worker-click`** and **`worker-email`** are BullMQ workers, each running the same base image with a different `command`, consuming the `clicks` and `emails` queues respectively (see [`ANALYTICS.md`](./ANALYTICS.md#write-pipeline)).
- **`cron`** is a separate image built from `Dockerfile.cron`, running Alpine's built-in `crond` to periodically invoke the flush scripts (see [Scheduled Jobs](#scheduled-jobs)).
- **`redis`** must be `redis-stack-server`, not vanilla Redis — the redirect path's existence check depends on the `BF.*` (Bloom filter) commands from the RedisBloom module, which isn't part of standard Redis.
- **MongoDB** is Atlas (managed), not containerized — `MONGO_URI` points at it directly from every service that needs it.

## Prerequisites

- Docker + Docker Compose (v2 syntax, as used in the compose files here).
- A MongoDB Atlas cluster (or any reachable MongoDB instance) and its connection string.
- A [Resend](https://resend.com) API key for transactional email (verification links, password resets).
- For local non-Docker development: Node.js 22+ (matches the `node:22-alpine` base image) — mainly relevant if you want to run scripts like `rebuildBloom.js` outside a container.

## Environment Variables

All services read from a single `.env` file (`env_file: .env` in both compose files) — not committed (excluded via `.dockerignore` and expected to be gitignored).

| Variable | Used by | Purpose |
|---|---|---|
| `NODE_ENV` | all | `production` / `development`. Gates rate-limiter skipping, cookie `secure`/`sameSite`, logger format, and is baked into the prod image directly (see [Docker Images](#docker-images)). |
| `PORT` | server | HTTP port the API listens on (defaults to `5000` if unset). |
| `SERVICE_NAME` | all | Tags structured logs by which service emitted them (`api`, `worker-click`, `worker-email`, `cron`) — set per-service in compose, not globally. |
| `LOG_LEVEL` | all | Pino log level (default `info` in prod, `debug` in dev). |
| `MONGO_URI` | all Mongo-touching services | Atlas connection string. |
| `REDIS_HOST` / `REDIS_PORT` | all | Overridden to `redis`/`6379` (the compose service name) in both compose files — only relevant to change for non-Docker local runs. |
| `REDIS_USERNAME` / `REDIS_PASSWORD` | all | Redis auth. `REDIS_PASSWORD` also feeds `REDIS_ARGS=--requirepass` on the `redis` service itself, so the container's own auth and every client's credentials come from the same value. |
| `JWT_SECRET` | auth | Signs/verifies access tokens (15 min). |
| `JWT_REFRESH_SECRET` | auth | Signs/verifies refresh tokens (20 days) — deliberately a **different** secret than `JWT_SECRET` (see [`SECURITY.md`](./SECURITY.md#authentication)). |
| `PASSWORD_PEPPER` | auth | Server-side pepper concatenated before argon2 hashing. Losing/rotating this invalidates every stored password hash — treat it like a second master secret, not a config toggle. |
| `RESEND_API_KEY` | email | Transactional email provider auth. |
| `APP_URL` | auth | Base URL of the **frontend**, used to build links in emails (verification, password reset) and the post-verification redirect target. |
| `APP_URL_CORS` | server | The single origin allowed by the CORS middleware (paired with `credentials: true`) — must exactly match the frontend's origin. |
| `BASE_URL` | shortUrl | Base URL of the **backend** itself, used to build the short links returned from `POST /api/create` (`BASE_URL + shortId`) and to strip the domain from pasted-in search queries. |
| `USE_ATLAS_SEARCH` | shortUrl | `"true"` to use the Atlas Search aggregation pipeline for URL search instead of the legacy MongoDB `$text` index — see [`DATABASE.md`](./DATABASE.md#search). Requires the `search_index` Atlas Search index to actually exist on the `shorturls` collection; setting this without that index configured will error. |

Set `NODE_ENV=production` for every real deployment — several dev-only bypasses (skipped rate limiting, verbose error output) are gated on it, and the production Dockerfile bakes it in as a safety net regardless of what's in `.env`.

## Local Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Builds from `Dockerfile.dev` — skips the non-root user, multi-stage slimming, and `--omit=dev` used in production, since none of that helps a fast local iteration loop.
- Source is **bind-mounted**, not copied into the image (`.:/usr/src/app`), so edits on disk are picked up immediately by `nodemon --legacy-watch` without a rebuild. (`--legacy-watch` — polling-based — is used specifically because bind-mounted filesystems on some Docker Desktop setups don't propagate native filesystem-event watching reliably.)
- An anonymous volume is mounted over `node_modules` (`/usr/src/app/node_modules`) specifically so the bind mount above doesn't overwrite the container's own `node_modules` — built for Linux inside the container — with whatever's in your host's `node_modules`, which would otherwise ship the wrong native binding for `argon2` and crash on import.
- `redis` exposes port `6379` to the host in dev (via `redis-cli`/RedisInsight-friendly `ports:`), which the production compose deliberately does not do.
- All rate limiters are skipped when `NODE_ENV=development` (set explicitly in this compose file), so local testing isn't throttled.

To run a single piece outside Docker entirely (e.g. just the API against a remote dev Redis/Mongo):
```bash
npm run server            # API only
npm run dev                # API + both workers concurrently (via `concurrently`)
npm run worker:click       # click-processing BullMQ worker
npm run worker:email       # email-sending BullMQ worker
```

## Production Stack

```bash
docker compose up -d --build
```

Brings up `redis`, two API replicas (`server` on `:5000`, `server2` on `:5001`), `worker-click`, `worker-email`, and `cron`, all on an internal bridge network (`internal`) — only the two API ports are published to the host; `redis` is not (in contrast to the dev compose file).

- Every service `depends_on: redis: condition: service_healthy` — nothing starts trying to talk to Redis until its own healthcheck (`redis-cli -a $REDIS_PASSWORD ping`) passes.
- `restart: unless-stopped` on every service — a crashed process (e.g. `uncaughtException` triggering the graceful-shutdown-then-exit path in `server.js`) comes back up automatically without manual intervention.
- **nginx is not part of this repo/compose stack.** It's expected to run on the host (the EC2 VPS) in front of `server`/`server2`, handling TLS termination and load-balancing between the two ports. There's no nginx config file checked into this repository to document further — if/when one is added, it belongs alongside this file.

## Docker Images

Three distinct Dockerfiles, each for a different purpose:

| Dockerfile | Used by | Notes |
|---|---|---|
| `Dockerfile` | `server`, `server2`, `worker-click`, `worker-email` | Multi-stage: a `base` stage installs deps (including the `python3 make g++` toolchain `argon2` needs to compile its native binding on Alpine) with `npm ci --omit=dev`, then a slim `runner` stage copies only `node_modules` + source, runs as a non-root user (`nodeapp`), and defaults to `node server.js` (overridden by `command:` for the worker services). |
| `Dockerfile.dev` | dev compose only | Single-stage, root user, `npm ci` (includes devDependencies), no source copy (bind-mounted instead) — optimized for rebuild speed, not for security or size. Explicitly commented as **not for production**. |
| `Dockerfile.cron` | `cron` | Same multi-stage/non-root pattern as the main `Dockerfile`, but its final `CMD` is Alpine's built-in `crond` (`crond -f -l 2`) rather than a Node process — `crond` itself runs as root (required to read `/etc/crontabs/root` and manage its own logging), but the actual job commands it spawns still execute as the `node` binary, not as a privileged process. |

All three share the same underlying pattern: install native-addon build tools only in an intermediate stage, ship only compiled `node_modules` + source in the final image, and bake `NODE_ENV=production` into the two production-facing images so it can't be silently unset.

## Scheduled Jobs

Defined in `docker/crontab`, mounted into the `cron` image at `/etc/crontabs/root` (permissions locked to `0600`), run by Alpine's built-in `crond` — no extra cron package needed.

| Schedule | Job | Purpose |
|---|---|---|
| `*/1 * * * *` (every minute) | `analyticsWorker.js` | Claims and flushes due, fully-elapsed **per-minute** Redis click-dimension buckets (`analytics:{urlId}:{date}:{HH:MM}`) into `ClickBucket` documents in MongoDB, in the same transaction as the `ShortUrl.clicks` `$inc` — see [`ANALYTICS.md`](./ANALYTICS.md#write-pipeline) and [Minute-Bucketed Buffering](./ANALYTICS.md#minute-bucketed-buffering). |
| `2-59/5 * * * *` (every 5 min, offset 2) | `analyticsRecoveryWorker.js` | Sweeps Redis `processing:active` for claimed-but-unflushed buckets older than a 5-minute stale threshold (i.e. a flush that crashed mid-transaction) and re-flushes them — the replay mechanism backing the claim-based durability fix, see [`ANALYTICS.md`](./ANALYTICS.md#known-gaps--accepted-risk). |

Both scripts are standalone: they connect to Mongo/Redis, do their work, and exit — not long-running processes — which is why they're driven by cron rather than being one of the always-on services above. Job output is redirected to the container's own stdout/stderr (`>> /proc/1/fd/1 2>> /proc/1/fd/2`) so it flows into the same logging pipeline as everything else instead of being silently dropped by `crond`.

**`analyticsWorker` runs every minute, but doesn't necessarily flush everything it sees on every run.** Redis buckets are scoped per-minute specifically so the flush job never has to read-then-delete a key a concurrent click could still be writing to — `flushAnalyticsKey` skips (no-ops on) any bucket whose 60-second window hasn't fully elapsed plus a further grace period, leaving it for a later run. Due buckets are claimed via an atomic Redis `RENAME` before being flushed (see [`ANALYTICS.md`](./ANALYTICS.md#write-pipeline)), and `ClickBucket`/`ShortUrl.clicks` are now written together in one MongoDB transaction, so a crash mid-flush leaves a recoverable `processing:*` claim instead of losing or duplicating data — `analyticsRecoveryWorker` (above) is what re-flushes those. Together this bounds analytics staleness to roughly 1–2 minutes end-to-end under normal operation, and closes the durability gap previously discussed in [`ANALYTICS.md`](./ANALYTICS.md#known-gaps--accepted-risk).

## Health Checks & Graceful Shutdown

- `GET /api/health` returns `{ success, inFlight }` normally, or `503 { success: false, status: "shutting_down" }` once a shutdown has started — this is what both the Docker healthcheck (`server`/`server2`) and, presumably, nginx/a load balancer should poll to know when to stop routing new traffic to an instance.
- `server.js` handles `SIGTERM`/`SIGINT` by: marking the process as shutting down (so `/api/health` and the global shutdown-check middleware start rejecting new work with `503`), closing the HTTP server (letting in-flight requests finish), then closing the MongoDB and Redis connections, all within a 10-second timeout before forcing `process.exit(1)`. This matters specifically for **rolling deploys/restarts** — `docker compose up -d --build` replacing a container sends `SIGTERM` first, and this handler is what turns that into a clean drain instead of dropped in-flight requests.
- `unhandledRejection` and `uncaughtException` both route through the same `gracefulShutdown` path (logged as `fatal`, then the same drain-and-exit sequence) rather than crashing instantly — combined with `restart: unless-stopped`, a truly unexpected error results in a clean restart, not a corrupted mid-request state.

## Logging

All services use `pino`, configured differently per environment (`src/logger/productionLogger.js` vs `devLogger.js`):

- **Production**: structured JSON to stdout, tagged with `service` (from `SERVICE_NAME`), `env`, and the app's own `package.json` version. Sensitive fields (`req.headers.authorization`, `req.headers.cookie`, and any field named `password`/`token`/`secret`/`apiKey` anywhere in the log object) are redacted before being written — this applies globally via a wildcard path (`**.password`, etc.), not just at specific known call sites.
- **Development**: the same structured events, piped through `pino-pretty` for human-readable colorized output instead of raw JSON.

Per the project's broader history, production log output (plain JSON on stdout, captured by Docker's `json-file` driver) is intended to be shipped off-host via [Vector](https://vector.dev) to [Axiom](https://axiom.co) for retention/search — that pipeline lives outside this repo (a Vector config, if one exists, isn't checked in here) and isn't something the application code talks to directly; the app's only job is to emit clean structured JSON to stdout and let the host-level pipeline take it from there.

## Rebuilding the Bloom Filter

The redirect path's existence check depends on `urls:bloom`, a RedisBloom filter that's normally kept in sync incrementally (`BF.ADD` on every URL creation). If it's ever lost — a Redis data-loss event, a fresh Redis instance, or a filter resized/recreated — it needs to be rebuilt from the source of truth in MongoDB rather than incrementally, or the redirect path will 404 every existing short URL until each one happens to get re-added some other way.

```bash
npm run script:rebuildBloom
```

This runs `src/scripts/rebuildBloom.js` against the configured `MONGO_URI`/Redis, re-adding every existing `short_url` from the `ShortUrl` collection into a fresh Bloom filter. Run this manually after any event that could have wiped Redis state, before traffic resumes — it's not wired into the automatic startup sequence of any service.

## Known Gaps / Accepted Risk

- **No CI/CD pipeline is defined in this repo** — builds and deploys (`docker compose up -d --build`) are presumed manual/SSH-driven against the EC2 host. No GitHub Actions workflow, no automated test-then-deploy gate.
- **No staging environment** — `NODE_ENV` only distinguishes `development` (local, `docker-compose.dev.yml`) from `production` (the compose file above); there's no intermediate environment for testing a deploy before it's live.
- **Secrets live in a single `.env` file with no rotation process** — `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `PASSWORD_PEPPER` in particular are high-blast-radius values (rotating `PASSWORD_PEPPER` invalidates every user's password) with no documented rotation runbook.
- **nginx configuration isn't version-controlled in this repository** — the reverse-proxy/TLS layer in front of `server`/`server2` exists only on the host, outside of anything reproducible from this repo alone.
