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
RUN bun install --frozen-lockfile

# ── Stage 2: builder (Next.js app only) ───────────────────────────────
FROM oven/bun:1.2 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
ENV DIRECT_DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
RUN bunx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
# Set dummy secrets for build — Next.js build evaluates auth.ts which requires
# NEXTAUTH_SECRET in production. The real secret is injected at runtime via .env.
ENV NODE_ENV=production
ENV NEXTAUTH_SECRET=build-time-dummy-secret-not-used-at-runtime
ENV NEXTAUTH_URL=http://localhost:3000
RUN bun run build

# ── Stage 3a: app (Next.js standalone) ────────────────────────────────
FROM oven/bun:1.2-slim AS app
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
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
ENV DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
ENV DIRECT_DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
CMD ["bunx", "prisma", "migrate", "deploy"]

# ── Stage 3b: worker (no Next.js build needed) ────────────────────────
FROM oven/bun:1.2-slim AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
# Copy deps from the deps stage (not builder — avoids running next build)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY mini-services/publish-worker ./mini-services/publish-worker
COPY prisma ./prisma
ENV DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
ENV DIRECT_DATABASE_URL=postgresql://nashrino:password@localhost:5432/nashrino?schema=public
RUN bunx prisma generate
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
COPY mini-services/realtime ./mini-services/realtime
USER nextjs
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3003/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["bun", "run", "mini-services/realtime/index.ts"]
