-- AlterTable: Add per-post fields to CommentDmRule
ALTER TABLE "CommentDmRule" ADD COLUMN "publicationId" TEXT;
ALTER TABLE "CommentDmRule" ADD COLUMN "igPostId" TEXT;
ALTER TABLE "CommentDmRule" ADD COLUMN "keywords" JSONB;
ALTER TABLE "CommentDmRule" ADD COLUMN "excludeKeywords" JSONB;
ALTER TABLE "CommentDmRule" ADD COLUMN "buttonText" TEXT;
ALTER TABLE "CommentDmRule" ADD COLUMN "buttonUrl" TEXT;
ALTER TABLE "CommentDmRule" ADD COLUMN "publicReply" TEXT;
ALTER TABLE "CommentDmRule" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- AddForeignKey: CommentDmRule -> Publication
ALTER TABLE "CommentDmRule" ADD CONSTRAINT "CommentDmRule_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
