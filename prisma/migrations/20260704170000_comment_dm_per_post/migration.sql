-- AlterTable: add per-post scoping fields to CommentDmRule
ALTER TABLE "CommentDmRule"
  ADD COLUMN "publicationId" TEXT,
  ADD COLUMN "igPostId"      TEXT,
  ADD COLUMN "publicReply"   TEXT;

-- CreateIndex
CREATE INDEX "CommentDmRule_publicationId_idx" ON "CommentDmRule"("publicationId");

-- AddForeignKey
ALTER TABLE "CommentDmRule"
  ADD CONSTRAINT "CommentDmRule_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
