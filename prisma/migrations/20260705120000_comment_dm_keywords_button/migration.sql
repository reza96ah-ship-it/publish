-- CommentDmRule: multi-keyword matching, quick-reply button, lifecycle status,
-- per-post scoping (#209)
ALTER TABLE "CommentDmRule"
  ADD COLUMN "publicationId"   TEXT,
  ADD COLUMN "igPostId"        TEXT,
  ADD COLUMN "keywords"        JSONB,
  ADD COLUMN "excludeKeywords" JSONB,
  ADD COLUMN "buttonText"      TEXT,
  ADD COLUMN "buttonUrl"       TEXT,
  ADD COLUMN "publicReply"     TEXT,
  ADD COLUMN "status"          TEXT NOT NULL DEFAULT 'active';

-- Backfill keywords[] from the existing single keyword so old rules keep matching.
UPDATE "CommentDmRule"
  SET "keywords" = to_jsonb(ARRAY["keyword"])
  WHERE "keywords" IS NULL;

-- AddForeignKey: CommentDmRule -> Publication (per-post scoping)
ALTER TABLE "CommentDmRule" ADD CONSTRAINT "CommentDmRule_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
