-- CreateEnum
-- (no enums — SmartPage uses plain String columns)

-- CreateTable
CREATE TABLE "SmartPage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "avatarUrl" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartPageClick" (
    "id" TEXT NOT NULL,
    "smartPageId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "SmartPageClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmartPage_workspaceId_slug_key" ON "SmartPage"("workspaceId", "slug");
CREATE INDEX "SmartPage_workspaceId_idx" ON "SmartPage"("workspaceId");
CREATE INDEX "SmartPage_slug_idx" ON "SmartPage"("slug");
CREATE INDEX "SmartPageClick_smartPageId_clickedAt_idx" ON "SmartPageClick"("smartPageId", "clickedAt");
CREATE INDEX "SmartPageClick_smartPageId_blockId_idx" ON "SmartPageClick"("smartPageId", "blockId");

-- AddForeignKey
ALTER TABLE "SmartPage" ADD CONSTRAINT "SmartPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageClick" ADD CONSTRAINT "SmartPageClick_smartPageId_fkey" FOREIGN KEY ("smartPageId") REFERENCES "SmartPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
