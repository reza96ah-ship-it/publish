-- Add unique constraint to prevent duplicate publications for the same revision+platform
CREATE UNIQUE INDEX "Publication_revisionId_platformId_key"
  ON "Publication"("revisionId", "platformId");
