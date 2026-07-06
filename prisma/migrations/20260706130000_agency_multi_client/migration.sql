-- CreateTable
CREATE TABLE "AgencyProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "isAgency" BOOLEAN NOT NULL DEFAULT true,
    "clientWorkspaceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandName" TEXT,
    "brandLogoUrl" TEXT,
    "hideNashrinoBranding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPortalAccess" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY['content:view', 'content:approve']::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyProfile_workspaceId_key" ON "AgencyProfile"("workspaceId");

-- CreateIndex
CREATE INDEX "AgencyProfile_isAgency_idx" ON "AgencyProfile"("isAgency");

-- CreateIndex
CREATE INDEX "WorkspaceTemplate_workspaceId_idx" ON "WorkspaceTemplate"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalAccess_accessToken_key" ON "ClientPortalAccess"("accessToken");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_workspaceId_idx" ON "ClientPortalAccess"("workspaceId");

-- CreateIndex
CREATE INDEX "ClientPortalAccess_accessToken_idx" ON "ClientPortalAccess"("accessToken");

-- AddForeignKey
ALTER TABLE "AgencyProfile" ADD CONSTRAINT "AgencyProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceTemplate" ADD CONSTRAINT "WorkspaceTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

