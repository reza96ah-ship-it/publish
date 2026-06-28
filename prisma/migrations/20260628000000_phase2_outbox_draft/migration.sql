-- Phase 2: Add ContentDraft (MISS-04) and OutboxEvent (MISS-01) models

-- ContentDraft: one row per user per workspace, upserted on autosave
CREATE TABLE "ContentDraft" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "authorId"    TEXT NOT NULL,
    "content"     JSONB NOT NULL,
    "channelIds"  TEXT[],
    "scheduledAt" TEXT,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentDraft_workspaceId_authorId_key" ON "ContentDraft"("workspaceId", "authorId");
CREATE INDEX "ContentDraft_workspaceId_idx" ON "ContentDraft"("workspaceId");

ALTER TABLE "ContentDraft"
    ADD CONSTRAINT "ContentDraft_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OutboxEvent: written in same transaction as Content+PublishJob; dispatcher enqueues to BullMQ
CREATE TABLE "OutboxEvent" (
    "id"            TEXT NOT NULL,
    "workspaceId"   TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL DEFAULT 'content',
    "aggregateId"   TEXT NOT NULL,
    "eventType"     TEXT NOT NULL DEFAULT 'publish_requested',
    "payload"       JSONB NOT NULL,
    "traceParent"   TEXT,
    "status"        TEXT NOT NULL DEFAULT 'pending',
    "attemptCount"  INTEGER NOT NULL DEFAULT 0,
    "availableAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt"      TIMESTAMP(3),
    "lockedBy"      TEXT,
    "deliveredAt"   TIMESTAMP(3),
    "lastError"     TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- Critical index for dispatcher: poll pending events ordered by availableAt
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");
CREATE INDEX "OutboxEvent_aggregateId_idx" ON "OutboxEvent"("aggregateId");
