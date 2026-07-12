ALTER TABLE "InboxThread"
ADD COLUMN "slaStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "firstResponseAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3);

UPDATE "InboxThread"
SET "slaStartedAt" = "createdAt";

UPDATE "InboxThread"
SET "resolvedAt" = "updatedAt"
WHERE "status" = 'resolved';
