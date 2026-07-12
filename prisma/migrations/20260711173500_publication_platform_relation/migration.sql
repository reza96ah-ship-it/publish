ALTER TABLE "Publication"
ADD CONSTRAINT "Publication_platformId_fkey"
FOREIGN KEY ("platformId") REFERENCES "Platform"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
