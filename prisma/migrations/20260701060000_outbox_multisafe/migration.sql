-- Issue #148: Outbox multi-worker safety — lease/fencing, dead-letter, replay fields

-- Add lease expiry field for crash recovery
ALTER TABLE "OutboxEvent" ADD COLUMN "lockExpiresAt" TIMESTAMP(3);

-- Add error classification fields
ALTER TABLE "OutboxEvent" ADD COLUMN "lastErrorCategory" TEXT;
ALTER TABLE "OutboxEvent" ADD COLUMN "lastSafeError" TEXT;

-- Add dead-letter + replay fields
ALTER TABLE "OutboxEvent" ADD COLUMN "deadLetteredAt" TIMESTAMP(3);
ALTER TABLE "OutboxEvent" ADD COLUMN "replayedFromId" TEXT;

-- Add index for lease expiry recovery queries
CREATE INDEX "OutboxEvent_status_lockExpiresAt_idx" ON "OutboxEvent"("status", "lockExpiresAt");
