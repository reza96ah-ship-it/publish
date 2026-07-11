-- Last INBOUND message time per thread — drives the Meta reply-window
-- countdown (24h DM / 7d comment private reply). lastMessageAt can't be used
-- because outbound replies bump it too.
ALTER TABLE "InboxThread" ADD COLUMN "lastInboundAt" TIMESTAMP(3);

-- Backfill from the newest inbound message where one exists; fall back to
-- lastMessageAt (best approximation for threads created before this column).
UPDATE "InboxThread" t
SET "lastInboundAt" = COALESCE(
  (
    SELECT MAX(m."createdAt")
    FROM "InboxThreadMessage" m
    WHERE m."threadId" = t.id AND m.direction = 'inbound'
  ),
  t."lastMessageAt"
);
