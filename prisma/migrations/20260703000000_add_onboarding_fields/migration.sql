-- AlterTable: add guided-onboarding tracking fields + work-week preference to Workspace
ALTER TABLE "Workspace" ADD COLUMN "workWeek" TEXT NOT NULL DEFAULT 'sat-wed';
ALTER TABLE "Workspace" ADD COLUMN "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Workspace" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
