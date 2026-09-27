ALTER TABLE "Workspace" ADD COLUMN "zernioProfileId" TEXT;

CREATE UNIQUE INDEX "Workspace_zernioProfileId_key" ON "Workspace"("zernioProfileId");
