-- Durable inbound provider webhook log.
-- Stores verified raw payloads before channel-specific ingestion transforms them
-- into inbox messages, conversations, automations, or analytics events.
CREATE TABLE "ProviderWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "providerObject" TEXT,
    "providerAccountId" TEXT,
    "payload" JSONB NOT NULL,
    "rawBody" TEXT NOT NULL,
    "signature" TEXT,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'received',
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderWebhookEvent_eventKey_key" ON "ProviderWebhookEvent"("eventKey");
CREATE INDEX "ProviderWebhookEvent_provider_receivedAt_idx" ON "ProviderWebhookEvent"("provider", "receivedAt");
CREATE INDEX "ProviderWebhookEvent_provider_status_idx" ON "ProviderWebhookEvent"("provider", "status");
CREATE INDEX "ProviderWebhookEvent_providerAccountId_receivedAt_idx" ON "ProviderWebhookEvent"("providerAccountId", "receivedAt");
