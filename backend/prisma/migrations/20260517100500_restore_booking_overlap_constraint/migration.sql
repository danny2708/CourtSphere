-- Restore PostgreSQL overlap protection after exposing the range column to Prisma as Unsupported.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "booking_time_range" tstzrange
GENERATED ALWAYS AS (tstzrange("start_datetime", "end_datetime", '[)')) STORED;

CREATE INDEX IF NOT EXISTS "bookings_time_range_idx"
ON "bookings" USING gist ("court_id", "booking_time_range");

ALTER TABLE "bookings"
DROP CONSTRAINT IF EXISTS "no_overlapping_active_bookings";

ALTER TABLE "bookings"
ADD CONSTRAINT "no_overlapping_active_bookings"
EXCLUDE USING gist (
  "court_id" WITH =,
  "booking_time_range" WITH &&
)
WHERE (
  "booking_status" IN (
    'PENDING_PAYMENT',
    'PAYMENT_PROCESSING',
    'CONFIRMED',
    'IN_USE'
  )
);
