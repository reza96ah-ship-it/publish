-- Issue #149: Stable logical operation identity + duplicate prevention

-- Add publicationOperationId to Publication (stable idempotency key per publication)
ALTER TABLE "Publication" ADD COLUMN "publicationOperationId" TEXT;

-- Create unique index — one operation ID per publication
CREATE UNIQUE INDEX "Publication_publicationOperationId_key" ON "Publication"("publicationOperationId");
