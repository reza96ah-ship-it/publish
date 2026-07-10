# ──────────────────────────────────────────────────────────────────────
# Nashrino — Multi-stage Dockerfile for production
# ──────────────────────────────────────────────────────────────────────
# 3 targets: app, worker, realtime (single Dockerfile, multiple images)
# All targets: non-root user, health checks, <500MB target.
#
# Build:
#   docker build -t nashrino-app .                              # app only
#   docker build --target worker -t nashrino-worker .           # worker
#   docker build --target realtime -t nashrino-realtime .       # realtime
# ──────────────────────────────────────────────────────────────────────

# ── Stage 1: deps ─────────────────────────────────────────────────────
FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun install --frozen-lockfile

# ── Stage 2: builder (Next.js app only) ───────────────────────────────
FROM oven/bun:1.2 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
ENV DIRECT_DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
# OpenSSL is required by Prisma's Rust engine — oven/bun:1.2 (Debian) ships without it
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN bun run db:generate
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js build evaluates auth.ts which requires NEXTAUTH_SECRET in production.
# Inline the dummy value in the RUN command so it's never declared as an
# ARG/ENV instruction — eliminates Docker Scout SecretsUsedInArgOrEnv warning.
# The real secret is injected at runtime via .env.
ENV NODE_ENV=production
ENV NEXTAUTH_URL=http://localhost:3000
RUN NEXTAUTH_SECRET=build-time-dummy-not-used-at-runtime bun run build

# ── Stage 3a: app (Next.js standalone) ────────────────────────────────
FROM oven/bun:1.2-slim AS app
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Pull latest Debian security patches for the base image (fixes OS CVEs found by Trivy)
# Issue #146 follow-up: ffmpeg provides ffprobe+ffmpeg for video duration/codec
# extraction and thumbnail generation (src/lib/video-probe.ts) — installed via apt
# rather than an npm prebuilt-binary package (license/bundler issues, see that file).
RUN apt-get update -y && apt-get upgrade -y && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Issue #146: local-dev media storage falls back to public/uploads/ — must be
# writable by the non-root runtime user.
RUN mkdir -p ./public/uploads && chown -R nextjs:nodejs ./public/uploads
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["bun", "server.js"]

# ── Stage 3d: migrate (dedicated — ships the pinned prisma CLI from deps) ─
FROM oven/bun:1.2-slim AS migrate
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY shared ./shared
COPY scripts ./scripts
CMD ["sh", "-c", "bun run scripts/validate-migrate.ts && bunx prisma migrate deploy"]

# ── Stage 3b: worker (no Next.js build needed) ────────────────────────
FROM oven/bun:1.2-slim AS worker
WORKDIR /app
ENV NODE_ENV=production
# Issue #157: install OpenSSL for Prisma engine
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
# Copy deps from the deps stage (not builder — avoids running next build)
COPY --from=deps /app/node_modules ./node_modules
# Issue #157: Copy generated Prisma client from builder stage (which already
# ran bunx prisma generate successfully). This avoids the Bun worker_threads
# incompatibility with Prisma 7.x generate command.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY package.json bun.lock ./
# Issue #150: shared/ holds framework-free modules imported by both the app
# (src/lib/*) and the worker (mini-services/publish-worker/lib/*) — e.g. the
# provider capability registry. It has no Next.js/React/Prisma dependencies,
# so it's cheap to include here without pulling in src/.
COPY shared ./shared
COPY mini-services/publish-worker ./mini-services/publish-worker
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
ENV DIRECT_DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
USER nextjs
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3002/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["bun", "run", "mini-services/publish-worker/index.ts"]

# ── Stage 3c: realtime (no Next.js build needed) ──────────────────────
FROM oven/bun:1.2-slim AS realtime
WORKDIR /app
ENV NODE_ENV=production
ENV REALTIME_PORT=3003
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY shared ./shared
COPY mini-services/realtime ./mini-services/realtime
USER nextjs
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3003/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["bun", "run", "mini-services/realtime/index.ts"]
