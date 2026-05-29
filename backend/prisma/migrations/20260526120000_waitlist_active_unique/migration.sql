DROP INDEX IF EXISTS "waitlist_entries_user_id_court_id_desired_start_datetime_de_key";

CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_entries_active_unique_idx"
ON "waitlist_entries"("user_id", "court_id", "desired_start_datetime", "desired_end_datetime")
WHERE "status" IN ('WAITING', 'NOTIFIED');
