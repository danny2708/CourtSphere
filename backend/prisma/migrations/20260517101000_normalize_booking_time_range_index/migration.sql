-- Recreate GiST index with explicit uuid_ops so Prisma Migrate sees the DB as matching schema.prisma.
DROP INDEX IF EXISTS "bookings_time_range_idx";

CREATE INDEX "bookings_time_range_idx"
ON "bookings" USING GIST ("court_id" gist_uuid_ops, "booking_time_range");
