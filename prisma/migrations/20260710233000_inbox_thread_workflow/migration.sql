ALTER TABLE "InboxThread"
  ADD COLUMN "assigneeId" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lockedById" TEXT,
  ADD COLUMN "lockExpiresAt" TIMESTAMP(3);

ALTER TABLE "InboxThread"
  ADD CONSTRAINT "InboxThread_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "WorkspaceMember"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboxThread"
  ADD CONSTRAINT "InboxThread_lockedById_fkey"
  FOREIGN KEY ("lockedById") REFERENCES "WorkspaceMember"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InboxThread_workspaceId_assigneeId_idx"
  ON "InboxThread"("workspaceId", "assigneeId");

CREATE INDEX "InboxThread_workspaceId_priority_idx"
  ON "InboxThread"("workspaceId", "priority");

CREATE INDEX "InboxThread_workspaceId_lockExpiresAt_idx"
  ON "InboxThread"("workspaceId", "lockExpiresAt");
