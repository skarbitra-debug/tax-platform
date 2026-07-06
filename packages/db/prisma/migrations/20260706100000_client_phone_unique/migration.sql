-- Client.phone becomes @unique (one phone = one individual).
-- Makes reuse-by-phone in createLead atomic (upsert / INSERT ... ON CONFLICT),
-- removing the race where two concurrent submissions created duplicate Clients.
-- The plain phone index is dropped: the unique index already covers lookups.

-- DropIndex
DROP INDEX "Client_phone_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");
