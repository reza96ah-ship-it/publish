ALTER TABLE "CommentDmLog"
    ADD COLUMN "providerMessageId" TEXT,
    ADD COLUMN "publicReplyStatus" TEXT,
    ADD COLUMN "errorCode" TEXT,
    ALTER COLUMN "status" SET DEFAULT 'pending';
