ALTER TABLE "Platform" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'direct';
ALTER TABLE "Platform" ADD COLUMN "providerAccountId" TEXT;

CREATE UNIQUE INDEX "Platform_provider_providerAccountId_key"
  ON "Platform"("provider", "providerAccountId");

ALTER TABLE "ProviderWebhookEvent" ADD COLUMN "automationScannedAt" TIMESTAMP(3);
