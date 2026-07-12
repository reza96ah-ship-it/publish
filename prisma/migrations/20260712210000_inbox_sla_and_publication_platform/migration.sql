-- Thread-level first-response SLA state. Existing rows are backfilled from
-- their message history so operational metrics are immediately meaningful.
ALTER TABLE "InboxThread"
  ADD COLUMN IF NOT EXISTS "slaStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

UPDATE "InboxThread" t
SET
  "slaStartedAt" = COALESCE(
    (
      SELECT MIN(m."createdAt")
      FROM "InboxThreadMessage" m
      WHERE m."threadId" = t.id AND m.direction = 'inbound'
    ),
    t."createdAt"
  ),
  "firstResponseAt" = (
    SELECT MIN(m."createdAt")
    FROM "InboxThreadMessage" m
    WHERE m."threadId" = t.id AND m.direction = 'outbound'
  ),
  "resolvedAt" = CASE WHEN t.status = 'resolved' THEN t."updatedAt" ELSE NULL END;

CREATE INDEX IF NOT EXISTS "InboxThread_workspaceId_status_firstResponseAt_slaStartedAt_idx"
  ON "InboxThread"("workspaceId", "status", "firstResponseAt", "slaStartedAt");

-- The worker reconciliation scanner includes Publication.platform. The scalar
-- platformId already existed; this restores the relational constraint Prisma
-- needs to materialize that include safely.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Publication_platformId_fkey'
  ) THEN
    ALTER TABLE "Publication"
      ADD CONSTRAINT "Publication_platformId_fkey"
      FOREIGN KEY ("platformId") REFERENCES "Platform"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
