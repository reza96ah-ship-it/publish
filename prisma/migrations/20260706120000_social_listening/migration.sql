-- CreateTable
CREATE TABLE "ListeningQuery" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minEngagement" INTEGER NOT NULL DEFAULT 0,
    "excludeSpam" BOOLEAN NOT NULL DEFAULT true,
    "spikeAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "spikeThreshold" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "spikeWindowHours" INTEGER NOT NULL DEFAULT 24,
    "providers" TEXT[] DEFAULT ARRAY['instagram']::TEXT[],
    "coverageNotes" TEXT,
    "shareToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningMention" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT,
    "sourceUrl" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "detectedLanguage" TEXT,
    "spamScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verifiedSentiment" TEXT,
    "autoSentiment" TEXT,
    "isSpike" BOOLEAN NOT NULL DEFAULT false,
    "spikeScore" DOUBLE PRECISION,
    "coverageSource" TEXT,
    "mentionedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListeningQuery_shareToken_key" ON "ListeningQuery"("shareToken");

-- CreateIndex
CREATE INDEX "ListeningQuery_workspaceId_idx" ON "ListeningQuery"("workspaceId");

-- CreateIndex
CREATE INDEX "ListeningQuery_isActive_idx" ON "ListeningQuery"("isActive");

-- CreateIndex
CREATE INDEX "ListeningMention_queryId_mentionedAt_idx" ON "ListeningMention"("queryId", "mentionedAt");

-- CreateIndex
CREATE INDEX "ListeningMention_workspaceId_idx" ON "ListeningMention"("workspaceId");

-- CreateIndex
CREATE INDEX "ListeningMention_isSpike_idx" ON "ListeningMention"("isSpike");

-- AddForeignKey
ALTER TABLE "ListeningQuery" ADD CONSTRAINT "ListeningQuery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningMention" ADD CONSTRAINT "ListeningMention_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "ListeningQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningMention" ADD CONSTRAINT "ListeningMention_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

