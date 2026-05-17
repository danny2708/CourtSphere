-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "BookingPermissionStatus" AS ENUM ('ALLOWED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'TEMP_CLOSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'PAYMENT_EXPIRED', 'CONFIRMED', 'IN_USE', 'COMPLETED', 'CANCELLED_BY_USER', 'CANCELLED_BY_MANAGER', 'CANCELLED_BY_ADMIN', 'CHECKIN_EXPIRED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SUCCESS', 'FAILED', 'MANUAL_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "ViolationType" AS ENUM ('LATE_CANCEL', 'CHECKIN_EXPIRED', 'NO_SHOW', 'OVERTIME_USAGE', 'POLICY_VIOLATION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CREATED', 'PAYMENT_SUCCESS', 'PAYMENT_EXPIRED', 'BOOKING_CANCELLED', 'REFUND_REQUESTED', 'REFUND_SUCCESS', 'CHECKIN_EXPIRED', 'NO_SHOW', 'VIOLATION_RECORDED', 'BOOKING_PERMISSION_RESTRICTED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'NOTIFIED', 'BOOKED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "priority_groups" (
    "priority_group_id" UUID NOT NULL,
    "group_name" TEXT NOT NULL,
    "priority_level" INTEGER NOT NULL,
    "advance_booking_days" INTEGER NOT NULL,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "priority_groups_pkey" PRIMARY KEY ("priority_group_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "priority_group_id" UUID,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_number" TEXT,
    "password_hash" TEXT NOT NULL,
    "identity_code" TEXT,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "booking_permission_status" "BookingPermissionStatus" NOT NULL DEFAULT 'ALLOWED',
    "booking_locked_until" TIMESTAMP(3),
    "violation_points" INTEGER NOT NULL DEFAULT 0,
    "reputation_points" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" UUID NOT NULL,
    "role_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "court_types" (
    "court_type_id" UUID NOT NULL,
    "type_name" TEXT NOT NULL,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "court_types_pkey" PRIMARY KEY ("court_type_id")
);

-- CreateTable
CREATE TABLE "courts" (
    "court_id" UUID NOT NULL,
    "court_type_id" UUID NOT NULL,
    "court_name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "status" "CourtStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("court_id")
);

-- CreateTable
CREATE TABLE "operating_hours" (
    "operating_hour_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,
    "slot_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("operating_hour_id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "pricing_rule_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "priority_group_id" UUID,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "applicable_day" INTEGER,
    "price_amount" DECIMAL(12,2) NOT NULL,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("pricing_rule_id")
);

-- CreateTable
CREATE TABLE "booking_rules" (
    "booking_rule_id" UUID NOT NULL,
    "rule_name" TEXT NOT NULL,
    "hold_minutes" INTEGER NOT NULL,
    "cancel_before_hours" INTEGER NOT NULL,
    "late_checkin_minutes" INTEGER NOT NULL,
    "max_bookings_per_day" INTEGER NOT NULL,
    "max_duration_minutes" INTEGER NOT NULL,
    "violation_threshold" INTEGER NOT NULL,
    "booking_ban_days" INTEGER NOT NULL,
    "refund_rate_user_on_time" INTEGER NOT NULL,
    "refund_rate_manager_fault" INTEGER NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_rules_pkey" PRIMARY KEY ("booking_rule_id")
);

-- CreateTable
CREATE TABLE "priority_policies" (
    "priority_policy_id" UUID NOT NULL,
    "priority_group_id" UUID NOT NULL,
    "policy_name" TEXT NOT NULL,
    "priority_level" INTEGER NOT NULL,
    "advance_booking_days" INTEGER NOT NULL,
    "max_bookings_per_day" INTEGER,
    "max_duration_minutes" INTEGER,
    "can_book_priority_slots" BOOLEAN NOT NULL DEFAULT false,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "priority_policies_pkey" PRIMARY KEY ("priority_policy_id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "booking_id" UUID NOT NULL,
    "booking_code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "start_datetime" TIMESTAMPTZ(3) NOT NULL,
    "end_datetime" TIMESTAMPTZ(3) NOT NULL,
    "participant_count" INTEGER NOT NULL,
    "usage_purpose" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "refundable" BOOLEAN NOT NULL DEFAULT true,
    "hold_expires_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "cancelled_by_user_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "checked_in_by_user_id" UUID,
    "completed_by_user_id" UUID,
    "no_show_marked_by_user_id" UUID,
    "manager_note" TEXT,
    "no_refund_reason" TEXT,
    "checkin_time" TIMESTAMP(3),
    "checkout_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("booking_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "gateway_transaction_id" TEXT,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "raw_callback" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "refund_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "refund_amount" DECIMAL(12,2) NOT NULL,
    "refund_reason" TEXT NOT NULL,
    "refund_status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_by_user_id" UUID,
    "processed_by_user_id" UUID,
    "gateway_refund_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("refund_id")
);

-- CreateTable
CREATE TABLE "booking_status_histories" (
    "booking_status_history_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "action_by_user_id" UUID,
    "old_status" "BookingStatus",
    "new_status" "BookingStatus" NOT NULL,
    "action_type" TEXT NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_histories_pkey" PRIMARY KEY ("booking_status_history_id")
);

-- CreateTable
CREATE TABLE "court_status_histories" (
    "court_status_history_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "old_status" "CourtStatus" NOT NULL,
    "new_status" "CourtStatus" NOT NULL,
    "reason" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "court_status_histories_pkey" PRIMARY KEY ("court_status_history_id")
);

-- CreateTable
CREATE TABLE "violations" (
    "violation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "violation_type" "ViolationType" NOT NULL,
    "penalty_points" INTEGER NOT NULL,
    "description" TEXT,
    "recorded_by_user_id" UUID,
    "is_waived" BOOLEAN NOT NULL DEFAULT false,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("violation_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "waitlist_entry_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "priority_group_id" UUID,
    "desired_start_datetime" TIMESTAMP(3) NOT NULL,
    "desired_end_datetime" TIMESTAMP(3) NOT NULL,
    "priority_order" INTEGER,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("waitlist_entry_id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "system_setting_id" UUID NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "description" TEXT,
    "updated_by_user_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("system_setting_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_log_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "priority_groups_group_name_key" ON "priority_groups"("group_name");

-- CreateIndex
CREATE INDEX "priority_groups_priority_level_idx" ON "priority_groups"("priority_level");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_identity_code_key" ON "users"("identity_code");

-- CreateIndex
CREATE INDEX "users_priority_group_id_idx" ON "users"("priority_group_id");

-- CreateIndex
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- CreateIndex
CREATE INDEX "users_booking_permission_status_idx" ON "users"("booking_permission_status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "court_types_type_name_key" ON "court_types"("type_name");

-- CreateIndex
CREATE INDEX "courts_court_type_id_idx" ON "courts"("court_type_id");

-- CreateIndex
CREATE INDEX "courts_status_idx" ON "courts"("status");

-- CreateIndex
CREATE INDEX "operating_hours_court_id_weekday_idx" ON "operating_hours"("court_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "operating_hours_court_id_weekday_key" ON "operating_hours"("court_id", "weekday");

-- CreateIndex
CREATE INDEX "pricing_rules_court_id_idx" ON "pricing_rules"("court_id");

-- CreateIndex
CREATE INDEX "pricing_rules_created_by_user_id_idx" ON "pricing_rules"("created_by_user_id");

-- CreateIndex
CREATE INDEX "pricing_rules_priority_group_id_idx" ON "pricing_rules"("priority_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_rules_rule_name_key" ON "booking_rules"("rule_name");

-- CreateIndex
CREATE INDEX "booking_rules_status_idx" ON "booking_rules"("status");

-- CreateIndex
CREATE INDEX "priority_policies_priority_level_idx" ON "priority_policies"("priority_level");

-- CreateIndex
CREATE INDEX "priority_policies_status_idx" ON "priority_policies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "priority_policies_priority_group_id_policy_name_key" ON "priority_policies"("priority_group_id", "policy_name");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_code_key" ON "bookings"("booking_code");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "bookings_court_id_start_datetime_end_datetime_idx" ON "bookings"("court_id", "start_datetime", "end_datetime");

-- CreateIndex
CREATE INDEX "bookings_booking_status_idx" ON "bookings"("booking_status");

-- CreateIndex
CREATE INDEX "bookings_payment_status_idx" ON "bookings"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_transaction_id_key" ON "payments"("gateway_transaction_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_gateway_refund_id_key" ON "refunds"("gateway_refund_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_booking_id_idx" ON "refunds"("booking_id");

-- CreateIndex
CREATE INDEX "refunds_refund_status_idx" ON "refunds"("refund_status");

-- CreateIndex
CREATE INDEX "booking_status_histories_booking_id_idx" ON "booking_status_histories"("booking_id");

-- CreateIndex
CREATE INDEX "booking_status_histories_action_by_user_id_idx" ON "booking_status_histories"("action_by_user_id");

-- CreateIndex
CREATE INDEX "court_status_histories_court_id_idx" ON "court_status_histories"("court_id");

-- CreateIndex
CREATE INDEX "court_status_histories_updated_by_user_id_idx" ON "court_status_histories"("updated_by_user_id");

-- CreateIndex
CREATE INDEX "violations_user_id_idx" ON "violations"("user_id");

-- CreateIndex
CREATE INDEX "violations_booking_id_idx" ON "violations"("booking_id");

-- CreateIndex
CREATE INDEX "violations_recorded_by_user_id_idx" ON "violations"("recorded_by_user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_booking_id_idx" ON "notifications"("booking_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "waitlist_entries_court_id_desired_start_datetime_desired_en_idx" ON "waitlist_entries"("court_id", "desired_start_datetime", "desired_end_datetime");

-- CreateIndex
CREATE INDEX "waitlist_entries_priority_group_id_idx" ON "waitlist_entries"("priority_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_user_id_court_id_desired_start_datetime_de_key" ON "waitlist_entries"("user_id", "court_id", "desired_start_datetime", "desired_end_datetime");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_setting_key_key" ON "system_settings"("setting_key");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_priority_group_id_fkey" FOREIGN KEY ("priority_group_id") REFERENCES "priority_groups"("priority_group_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_court_type_id_fkey" FOREIGN KEY ("court_type_id") REFERENCES "court_types"("court_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("court_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("court_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_priority_group_id_fkey" FOREIGN KEY ("priority_group_id") REFERENCES "priority_groups"("priority_group_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_rules" ADD CONSTRAINT "booking_rules_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_policies" ADD CONSTRAINT "priority_policies_priority_group_id_fkey" FOREIGN KEY ("priority_group_id") REFERENCES "priority_groups"("priority_group_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_policies" ADD CONSTRAINT "priority_policies_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("court_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_in_by_user_id_fkey" FOREIGN KEY ("checked_in_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_show_marked_by_user_id_fkey" FOREIGN KEY ("no_show_marked_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_user_id_fkey" FOREIGN KEY ("processed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_histories" ADD CONSTRAINT "booking_status_histories_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_histories" ADD CONSTRAINT "booking_status_histories_action_by_user_id_fkey" FOREIGN KEY ("action_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_status_histories" ADD CONSTRAINT "court_status_histories_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("court_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "court_status_histories" ADD CONSTRAINT "court_status_histories_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("court_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_priority_group_id_fkey" FOREIGN KEY ("priority_group_id") REFERENCES "priority_groups"("priority_group_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manual PostgreSQL overlap protection for active booking statuses.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "booking_time_range" tstzrange
GENERATED ALWAYS AS (tstzrange("start_datetime", "end_datetime", '[)')) STORED;

CREATE INDEX IF NOT EXISTS "bookings_time_range_idx"
ON "bookings" USING gist ("court_id", "booking_time_range");

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

