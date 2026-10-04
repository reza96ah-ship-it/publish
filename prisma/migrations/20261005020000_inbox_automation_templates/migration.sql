ALTER TABLE "InboxThreadMessage" ADD COLUMN "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "InboxThreadMessage_workspaceId_messageType_direction_ingestedAt_idx"
  ON "InboxThreadMessage"("workspaceId", "messageType", "direction", "ingestedAt");

ALTER TABLE "Notification" ADD COLUMN "recipientMemberId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "href" TEXT;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientMemberId_fkey"
  FOREIGN KEY ("recipientMemberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Notification_workspaceId_recipientMemberId_isRead_idx"
  ON "Notification"("workspaceId", "recipientMemberId", "isRead");

ALTER TABLE "AutomationRun" ADD COLUMN "eventKey" TEXT;
ALTER TABLE "Automation" ADD COLUMN "activatedAt" TIMESTAMP(3);
ALTER TABLE "Automation" ADD COLUMN "templateId" TEXT;
CREATE UNIQUE INDEX "Automation_workspaceId_templateId_key" ON "Automation"("workspaceId", "templateId");
CREATE UNIQUE INDEX "AutomationRun_automationId_eventKey_key"
  ON "AutomationRun"("automationId", "eventKey");
