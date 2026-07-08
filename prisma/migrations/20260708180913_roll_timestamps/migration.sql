-- AlterTable
ALTER TABLE "rolls" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "rolls_campaign_id_updated_at_idx" ON "rolls"("campaign_id", "updated_at");
