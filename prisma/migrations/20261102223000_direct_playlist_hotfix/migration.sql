-- Preserve earlier history without implying that a destination playlist was created.
UPDATE "Transfer" SET "status" = 'legacy', "error" = 'Earlier release: no destination playlist was created.' WHERE "destinationMode" = 'csv';
UPDATE "TransferTrack" SET "result" = 'legacy_not_transferred' WHERE "result" = 'exported';
ALTER TABLE "Transfer" DROP COLUMN "sourceMode", DROP COLUMN "destinationMode";
ALTER TABLE "TransferTrack" ADD COLUMN "album" TEXT;

ALTER TABLE "PlatformConnection" ADD COLUMN "refreshLeaseUntil" TIMESTAMP(3);
