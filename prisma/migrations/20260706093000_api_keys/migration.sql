-- Replace the single campaigns.ingest_key_hash with a proper multi-key table.
-- Existing keys can't be migrated (only hashes exist and the column is being
-- dropped) — GMs mint fresh keys from campaign settings.

CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

CREATE INDEX "api_keys_campaign_id_idx" ON "api_keys"("campaign_id");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaigns" DROP COLUMN "ingest_key_hash";
