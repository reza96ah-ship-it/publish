CREATE TABLE "InboxReplyAttempt" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "activeThreadId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "replyHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerMessageId" TEXT,
    "threadMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InboxReplyAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxReplyAttempt_idempotencyKey_key" ON "InboxReplyAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "InboxReplyAttempt_activeThreadId_key" ON "InboxReplyAttempt"("activeThreadId");
CREATE INDEX "InboxReplyAttempt_workspaceId_threadId_status_idx" ON "InboxReplyAttempt"("workspaceId", "threadId", "status");
ALTER TABLE "InboxReplyAttempt" ADD CONSTRAINT "InboxReplyAttempt_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "InboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
