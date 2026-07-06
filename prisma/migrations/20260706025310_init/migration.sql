-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "ingest_token" TEXT NOT NULL,
    "join_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "last_event_type" TEXT NOT NULL,
    "payload" JSONB,
    "received_count" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "raw_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_ingest_token_key" ON "campaigns"("ingest_token");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_join_code_key" ON "campaigns"("join_code");

-- CreateIndex
CREATE INDEX "raw_events_campaign_id_updated_at_idx" ON "raw_events"("campaign_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "raw_events_campaign_id_message_id_key" ON "raw_events"("campaign_id", "message_id");

-- AddForeignKey
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
