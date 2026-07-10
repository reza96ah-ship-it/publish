-- Conversation-thread foundation for the inbox.
-- Webhook ingestion writes here first, while the legacy InboxMessage table is
-- still populated for the current UI.
CREATE TABLE "InboxThread" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "providerThreadId" TEXT NOT NULL,
    "providerUserId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "messageType" TEXT NOT NULL DEFAULT 'dm',
    "status" TEXT NOT NULL DEFAULT 'new',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboxThreadMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "messageType" TEXT NOT NULL DEFAULT 'dm',
    "senderExternalId" TEXT,
    "senderName" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxThreadMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxThread_platformId_providerThreadId_key" ON "InboxThread"("platformId", "providerThreadId");
CREATE INDEX "InboxThread_workspaceId_lastMessageAt_idx" ON "InboxThread"("workspaceId", "lastMessageAt");
CREATE INDEX "InboxThread_workspaceId_status_idx" ON "InboxThread"("workspaceId", "status");
CREATE INDEX "InboxThread_platformId_lastMessageAt_idx" ON "InboxThread"("platformId", "lastMessageAt");

CREATE UNIQUE INDEX "InboxThreadMessage_platformId_providerMessageId_key" ON "InboxThreadMessage"("platformId", "providerMessageId");
CREATE INDEX "InboxThreadMessage_threadId_createdAt_idx" ON "InboxThreadMessage"("threadId", "createdAt");
CREATE INDEX "InboxThreadMessage_workspaceId_createdAt_idx" ON "InboxThreadMessage"("workspaceId", "createdAt");
CREATE INDEX "InboxThreadMessage_platformId_createdAt_idx" ON "InboxThreadMessage"("platformId", "createdAt");

ALTER TABLE "InboxThread" ADD CONSTRAINT "InboxThread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxThread" ADD CONSTRAINT "InboxThread_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxThreadMessage" ADD CONSTRAINT "InboxThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
