-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "hide_death_saves" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hide_death_saves_since" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "rolls" ADD COLUMN     "is_hidden" BOOLEAN NOT NULL DEFAULT false;
