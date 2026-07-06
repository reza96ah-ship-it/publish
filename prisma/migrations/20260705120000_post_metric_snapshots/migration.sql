-- Issue #215: per-post metric snapshots

-- CreateTable
CREATE TABLE "PostMetricSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostMetricSnapshot_publicationId_date_metricType_key" ON "PostMetricSnapshot"("publicationId", "date", "metricType");
CREATE INDEX "PostMetricSnapshot_workspaceId_date_idx" ON "PostMetricSnapshot"("workspaceId", "date");
CREATE INDEX "PostMetricSnapshot_publicationId_idx" ON "PostMetricSnapshot"("publicationId");

-- AddForeignKey
ALTER TABLE "PostMetricSnapshot" ADD CONSTRAINT "PostMetricSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMetricSnapshot" ADD CONSTRAINT "PostMetricSnapshot_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
