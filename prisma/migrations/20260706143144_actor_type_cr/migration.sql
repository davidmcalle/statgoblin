-- AlterTable
ALTER TABLE "actors" ADD COLUMN     "actor_type" TEXT,
ADD COLUMN     "cr" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "rolls" ADD COLUMN     "actor_type" TEXT;
