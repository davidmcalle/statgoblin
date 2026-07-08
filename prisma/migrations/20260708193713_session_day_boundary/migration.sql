-- Session day boundary moves from midnight to 6am: a game that crosses
-- midnight stays one session. rolls.session_date is the effective day
-- ((rolled_at - 6h)::date, overridable per message via raw_events).

-- AlterTable
ALTER TABLE "raw_events" ADD COLUMN     "session_override" DATE;

-- AlterTable: add nullable, backfill from rolled_at, then enforce NOT NULL.
ALTER TABLE "rolls" ADD COLUMN     "session_date" DATE;

UPDATE "rolls" SET "session_date" = (("rolled_at" - interval '6 hours') AT TIME ZONE 'UTC')::date;

ALTER TABLE "rolls" ALTER COLUMN "session_date" SET NOT NULL;

-- CreateIndex
CREATE INDEX "rolls_campaign_id_session_date_idx" ON "rolls"("campaign_id", "session_date");
