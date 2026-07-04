-- CommentDmRule: multi-keyword matching, quick-reply button, lifecycle status (#209 PR1)
ALTER TABLE "CommentDmRule"
  ADD COLUMN "keywords"        JSONB,
  ADD COLUMN "excludeKeywords" JSONB,
  ADD COLUMN "buttonText"      TEXT,
  ADD COLUMN "buttonUrl"       TEXT,
  ADD COLUMN "status"          TEXT NOT NULL DEFAULT 'active';

-- Backfill keywords[] from the existing single keyword so old rules keep matching.
UPDATE "CommentDmRule"
  SET "keywords" = to_jsonb(ARRAY["keyword"])
  WHERE "keywords" IS NULL;
