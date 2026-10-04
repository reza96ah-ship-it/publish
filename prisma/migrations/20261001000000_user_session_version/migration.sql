-- Existing JWTs implicitly have version 0; a password change increments it.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
