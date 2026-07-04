-- Add status workflow + SLA fields to InboxMessage

ALTER TABLE "InboxMessage"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN "slaStartedAt" TIMESTAMP(3),
  ADD COLUMN "firstResponseAt" TIMESTAMP(3),
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InboxMessage_workspaceId_status_idx" ON "InboxMessage"("workspaceId", "status");
