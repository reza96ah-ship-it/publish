-- Issue #145: Publication model redesign — ContentRevision, ChannelVariant,
-- RevisionMedia, Publication entities. Replaces the thumbnailUrl-as-media pattern.

-- CreateTable: ContentRevision
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "hashtags" TEXT,
    "internalNote" TEXT,
    "authorName" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContentRevision_contentId_idx" ON "ContentRevision"("contentId");
CREATE INDEX "ContentRevision_workspaceId_idx" ON "ContentRevision"("workspaceId");

-- CreateTable: ChannelVariant
CREATE TABLE "ChannelVariant" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "caption" TEXT,
    CONSTRAINT "ChannelVariant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelVariant_revisionId_platformId_key" ON "ChannelVariant"("revisionId", "platformId");
CREATE INDEX "ChannelVariant_platformId_idx" ON "ChannelVariant"("platformId");

-- CreateTable: RevisionMedia
CREATE TABLE "RevisionMedia" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'photo',
    "altText" TEXT,
    CONSTRAINT "RevisionMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RevisionMedia_revisionId_position_key" ON "RevisionMedia"("revisionId", "position");
CREATE INDEX "RevisionMedia_revisionId_idx" ON "RevisionMedia"("revisionId");
CREATE INDEX "RevisionMedia_mediaId_idx" ON "RevisionMedia"("mediaId");

-- CreateTable: Publication
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "publishJobId" TEXT,
    "campaignId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processLabel" TEXT NOT NULL DEFAULT 'در انتظار',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "providerPostId" TEXT,
    "providerAcknowledgedAt" TIMESTAMP(3),
    "requestFingerprint" TEXT,
    "providerOperationId" TEXT,
    "reconciliationStatus" TEXT,
    "errorCategory" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Publication_workspaceId_idx" ON "Publication"("workspaceId");
CREATE INDEX "Publication_contentId_idx" ON "Publication"("contentId");
CREATE INDEX "Publication_revisionId_idx" ON "Publication"("revisionId");
CREATE INDEX "Publication_platformId_idx" ON "Publication"("platformId");
CREATE INDEX "Publication_status_idx" ON "Publication"("status");
CREATE INDEX "Publication_requestFingerprint_idx" ON "Publication"("requestFingerprint");

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelVariant" ADD CONSTRAINT "ChannelVariant_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "ContentRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevisionMedia" ADD CONSTRAINT "RevisionMedia_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "ContentRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "ContentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
