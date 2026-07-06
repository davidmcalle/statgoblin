-- AlterTable
ALTER TABLE "rolls" ADD COLUMN     "dc" INTEGER,
ADD COLUMN     "dice" JSONB,
ADD COLUMN     "modifier" DOUBLE PRECISION;
