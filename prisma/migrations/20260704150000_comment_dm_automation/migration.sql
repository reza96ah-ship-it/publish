-- CreateTable: CommentDmRule
CREATE TABLE "CommentDmRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "dmTemplate" TEXT NOT NULL,
    "optOutKeyword" TEXT NOT NULL DEFAULT 'نه',
    "freqCapHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommentDmRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CommentDmLog
CREATE TABLE "CommentDmLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',

    CONSTRAINT "CommentDmLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentDmRule_workspaceId_idx" ON "CommentDmRule"("workspaceId");
CREATE INDEX "CommentDmRule_platformId_isActive_idx" ON "CommentDmRule"("platformId", "isActive");
CREATE UNIQUE INDEX "CommentDmLog_ruleId_commentId_key" ON "CommentDmLog"("ruleId", "commentId");
CREATE INDEX "CommentDmLog_workspaceId_idx" ON "CommentDmLog"("workspaceId");
CREATE INDEX "CommentDmLog_ruleId_senderUserId_sentAt_idx" ON "CommentDmLog"("ruleId", "senderUserId", "sentAt");

-- AddForeignKey
ALTER TABLE "CommentDmRule" ADD CONSTRAINT "CommentDmRule_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentDmRule" ADD CONSTRAINT "CommentDmRule_platformId_fkey"
    FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentDmLog" ADD CONSTRAINT "CommentDmLog_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
