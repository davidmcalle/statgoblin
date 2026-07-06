-- CreateTable
CREATE TABLE "rolls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "raw_event_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "roll_index" INTEGER NOT NULL,
    "roll_type" TEXT NOT NULL,
    "actor_fid" TEXT,
    "actor_name" TEXT,
    "token_fid" TEXT,
    "token_name" TEXT,
    "author_name" TEXT,
    "author_role" TEXT,
    "item_name" TEXT,
    "item_type" TEXT,
    "activity_type" TEXT,
    "formula" TEXT,
    "total" DOUBLE PRECISION,
    "d20" INTEGER,
    "advantage_state" INTEGER,
    "is_nat20" BOOLEAN NOT NULL DEFAULT false,
    "is_nat1" BOOLEAN NOT NULL DEFAULT false,
    "is_hit" BOOLEAN,
    "is_critical" BOOLEAN,
    "damage_total" DOUBLE PRECISION,
    "damage_type" TEXT,
    "target_count" INTEGER,
    "ability" TEXT,
    "skill" TEXT,
    "prof_multiplier" DOUBLE PRECISION,
    "rolled_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "foundry_actor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL DEFAULT '',
    "assigned_user_id" TEXT,
    "roll_count" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "derive_state" (
    "campaign_id" UUID NOT NULL,
    "parser_version" INTEGER NOT NULL,
    "derived_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "derive_state_pkey" PRIMARY KEY ("campaign_id")
);

-- CreateIndex
CREATE INDEX "rolls_campaign_id_rolled_at_idx" ON "rolls"("campaign_id", "rolled_at");

-- CreateIndex
CREATE INDEX "rolls_campaign_id_actor_fid_idx" ON "rolls"("campaign_id", "actor_fid");

-- CreateIndex
CREATE INDEX "rolls_campaign_id_roll_type_idx" ON "rolls"("campaign_id", "roll_type");

-- CreateIndex
CREATE UNIQUE INDEX "rolls_raw_event_id_roll_index_key" ON "rolls"("raw_event_id", "roll_index");

-- CreateIndex
CREATE INDEX "actors_campaign_id_assigned_user_id_idx" ON "actors"("campaign_id", "assigned_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "actors_campaign_id_foundry_actor_id_key" ON "actors"("campaign_id", "foundry_actor_id");

-- AddForeignKey
ALTER TABLE "rolls" ADD CONSTRAINT "rolls_raw_event_id_fkey" FOREIGN KEY ("raw_event_id") REFERENCES "raw_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
