-- Issue #116: Instagram token expiry lifecycle
-- Adds tokenExpiresAt, tokenScopes, lastValidatedAt to Platform so the worker
-- can warn users before 60-day long-lived tokens expire and surface auth errors
-- instead of retrying dead tokens.

-- AlterTable
ALTER TABLE "Platform" ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "tokenScopes" TEXT,
ADD COLUMN "lastValidatedAt" TIMESTAMP(3);

-- Index for the daily expiry-scan job: find tokens expiring within N days.
-- Only Instagram/LinkedIn have expiry (bot tokens don't expire), but indexing
-- the column is cheap and speeds up the scan regardless of platform type.
CREATE INDEX "Platform_tokenExpiresAt_idx" ON "Platform"("tokenExpiresAt");
