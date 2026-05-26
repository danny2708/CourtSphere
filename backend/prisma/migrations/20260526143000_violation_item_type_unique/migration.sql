CREATE UNIQUE INDEX IF NOT EXISTS "violations_booking_item_type_unique_idx"
ON "violations"("booking_item_id", "violation_type")
WHERE "booking_item_id" IS NOT NULL;
