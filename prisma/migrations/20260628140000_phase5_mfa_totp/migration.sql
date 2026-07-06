-- Issue #121: MFA (TOTP) for administrator accounts.
-- Adds MFA fields to the User model for TOTP-based two-factor auth.
-- Secrets are stored encrypted (AES-256-GCM) via src/lib/crypto.ts.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mfaSecretPending" TEXT,
ADD COLUMN "mfaSecret" TEXT,
ADD COLUMN "mfaBackupCodes" TEXT,
ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);
