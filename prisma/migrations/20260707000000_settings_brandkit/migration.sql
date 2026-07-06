-- Issue #213 / settings-brandkit: workspace "banned words" list (comma-separated
-- Persian phrases) + per-user notification preferences JSON.
--
-- Both columns are nullable so existing rows are unaffected. Application code
-- treats NULL/empty as "no restriction" / "use defaults".

-- AlterTable: add bannedWords to Workspace
ALTER TABLE "Workspace" ADD COLUMN "bannedWords" TEXT DEFAULT '';

-- AlterTable: add notificationPreferences to User
ALTER TABLE "User" ADD COLUMN "notificationPreferences" JSONB;
