-- Issue #146: media lifecycle (presign -> upload -> validate) tracking

ALTER TABLE "Media"
  ALTER COLUMN "url" SET DEFAULT '',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "uploaderId" TEXT,
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "storageBucket" TEXT,
  ADD COLUMN "storageKey" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "declaredType" TEXT,
  ADD COLUMN "detectedType" TEXT,
  ADD COLUMN "actualSize" INTEGER,
  ADD COLUMN "checksumAlgo" TEXT,
  ADD COLUMN "checksumValue" TEXT,
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "codec" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "validatedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedReason" TEXT;

-- Backfill: rows created before this migration already went through the old
-- (less strict) upload flow and have a real object on disk/S3 — treat them as
-- validated so they keep appearing in the media library.
UPDATE "Media"
SET
  "status" = 'validated',
  "storageKey" = regexp_replace("url", '^/(uploads/)?', ''),
  "validatedAt" = "createdAt"
WHERE "url" IS NOT NULL AND "url" != '';

CREATE INDEX "Media_workspaceId_status_idx" ON "Media"("workspaceId", "status");
CREATE INDEX "Media_status_expiresAt_idx" ON "Media"("status", "expiresAt");
