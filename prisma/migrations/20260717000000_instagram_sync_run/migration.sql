-- Content.origin + Content.importedPostId: distinguish Nashrino-created vs
-- Instagram-imported content (issue #346). Existing rows default to NASHRINO.
ALTER TABLE "Content"
  ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'NASHRINO',
  ADD COLUMN IF NOT EXISTS "importedPostId" TEXT;

-- InstagramSyncRun: idempotent, resumable, checkpointed initial sync run tracker.
-- Issue #346: each sync run records status, step progress, cursor, and import counts.
-- Safe to run multiple times — checkpoint + cursor prevent duplicates.

CREATE TABLE "InstagramSyncRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currentStep" TEXT,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "checkpoint" JSONB,
    "lastProviderCursor" TEXT,
    "importedMediaCount" INTEGER NOT NULL DEFAULT 0,
    "importedConversationCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstagramSyncRun_workspaceId_idx" ON "InstagramSyncRun"("workspaceId");
CREATE INDEX "InstagramSyncRun_platformId_idx" ON "InstagramSyncRun"("platformId");
CREATE INDEX "InstagramSyncRun_platformId_status_idx" ON "InstagramSyncRun"("platformId", "status");
CREATE INDEX "InstagramSyncRun_workspaceId_createdAt_idx" ON "InstagramSyncRun"("workspaceId", "createdAt");

ALTER TABLE "InstagramSyncRun"
    ADD CONSTRAINT "InstagramSyncRun_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstagramSyncRun"
    ADD CONSTRAINT "InstagramSyncRun_platformId_fkey"
    FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
