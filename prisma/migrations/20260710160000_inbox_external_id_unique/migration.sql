-- Dedup key for the worker's inbox ingest scanner — one row per provider
-- comment/message per platform. Postgres unique indexes allow multiple NULLs,
-- so seed/demo rows (externalId IS NULL) are unaffected.
CREATE UNIQUE INDEX "InboxMessage_platformId_externalId_key" ON "InboxMessage"("platformId", "externalId");
