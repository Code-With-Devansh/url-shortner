# syntax=docker/dockerfile:1

# ---- base: shared deps layer ----
FROM node:22-alpine AS base
WORKDIR /usr/src/app

# argon2 needs build tools to compile/install its native binding on alpine
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- final image ----
FROM node:22-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production

# non-root user
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

COPY --from=base /usr/src/app/node_modules ./node_modules
COPY . .

RUN chown -R nodeapp:nodeapp /usr/src/app
USER nodeapp

EXPOSE 5000

# default command is the API server; overridden per-service in docker-compose.yml
CMD ["node", "server.js"]
