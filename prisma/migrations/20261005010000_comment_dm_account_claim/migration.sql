-- Nullable claim keys preserve existing run history and skipped rows. Only a
-- pending send sets claimPlatformId, so PostgreSQL enforces one send claim per
-- account/comment and per account/post/commenter across competing rules.
ALTER TABLE "CommentDmLog"
    ADD COLUMN "postId" TEXT,
    ADD COLUMN "claimPlatformId" TEXT;

CREATE UNIQUE INDEX "CommentDmLog_claimPlatformId_commentId_key"
    ON "CommentDmLog"("claimPlatformId", "commentId");
CREATE UNIQUE INDEX "CommentDmLog_claimPlatformId_postId_senderUserId_key"
    ON "CommentDmLog"("claimPlatformId", "postId", "senderUserId");
