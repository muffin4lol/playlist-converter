-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "destinationMode" TEXT NOT NULL DEFAULT 'direct',
ADD COLUMN     "sourceMode" TEXT NOT NULL DEFAULT 'direct';
