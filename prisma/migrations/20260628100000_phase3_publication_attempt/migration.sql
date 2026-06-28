-- Phase 3: Add PublicationAttempt ledger (MISS-02) and cancelled status

-- PublicationAttempt: one row per provider call attempt, prevents duplicate posts
CREATE TABLE "PublicationAttempt" (
    "id"                     TEXT NOT NULL,
    "publishJobId"           TEXT NOT NULL,
    "attemptNumber"          INTEGER NOT NULL,
    "requestFingerprint"     TEXT NOT NULL,
    "providerOperationId"    TEXT,
    "providerPostId"         TEXT,
    "outcome"                TEXT NOT NULL,
    "errorCategory"          TEXT,
    "safeUserMessage"        TEXT,
    "startedAt"              TIMESTAMP(3) NOT NULL,
    "providerAcknowledgedAt" TIMESTAMP(3),
    "locallyCommittedAt"     TIMESTAMP(3),
    "completedAt"            TIMESTAMP(3),

    CONSTRAINT "PublicationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicationAttempt_publishJobId_idx" ON "PublicationAttempt"("publishJobId");
CREATE INDEX "PublicationAttempt_requestFingerprint_idx" ON "PublicationAttempt"("requestFingerprint");

ALTER TABLE "PublicationAttempt"
    ADD CONSTRAINT "PublicationAttempt_publishJobId_fkey"
    FOREIGN KEY ("publishJobId") REFERENCES "PublishJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
