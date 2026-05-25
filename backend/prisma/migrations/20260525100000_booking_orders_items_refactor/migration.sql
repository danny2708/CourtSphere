-- Refactor booking storage from single booking records to order + item records.
-- This migration intentionally drops old dev booking/payment/refund/history data.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "no_overlapping_active_bookings";

DROP TABLE IF EXISTS "booking_status_histories" CASCADE;
DROP TABLE IF EXISTS "refunds" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "violations" CASCADE;
DROP TABLE IF EXISTS "notifications" CASCADE;
DROP TABLE IF EXISTS "bookings" CASCADE;

ALTER TABLE "courts" DROP COLUMN IF EXISTS "location";
ALTER TABLE "courts" DROP COLUMN IF EXISTS "capacity";

CREATE TABLE "booking_orders" (
    "booking_order_id" UUID NOT NULL,
    "booking_code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "refundable" BOOLEAN NOT NULL DEFAULT true,
    "hold_expires_at" TIMESTAMP(3),
    "note" TEXT,
    "cancel_reason" TEXT,
    "cancelled_by_user_id" UUID,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_orders_pkey" PRIMARY KEY ("booking_order_id")
);

CREATE TABLE "booking_items" (
    "booking_item_id" UUID NOT NULL,
    "booking_order_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "start_datetime" TIMESTAMPTZ(3) NOT NULL,
    "end_datetime" TIMESTAMPTZ(3) NOT NULL,
    "booking_time_range" tstzrange GENERATED ALWAYS AS (tstzrange(start_datetime, end_datetime, '[)'::text)) STORED,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "checkin_time" TIMESTAMP(3),
    "checked_in_by_user_id" UUID,
    "completed_by_user_id" UUID,
    "no_show_marked_by_user_id" UUID,
    "manager_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("booking_item_id")
);

CREATE TABLE "payments" (
    "payment_id" UUID NOT NULL,
    "booking_order_id" UUID NOT NULL,
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

CREATE TABLE "refunds" (
    "refund_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "booking_order_id" UUID NOT NULL,
    "booking_item_id" UUID,
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

CREATE TABLE "booking_order_status_histories" (
    "booking_order_status_history_id" UUID NOT NULL,
    "booking_order_id" UUID NOT NULL,
    "action_by_user_id" UUID,
    "old_status" "BookingStatus",
    "new_status" "BookingStatus" NOT NULL,
    "action_type" TEXT NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_order_status_histories_pkey" PRIMARY KEY ("booking_order_status_history_id")
);

CREATE TABLE "booking_item_status_histories" (
    "booking_item_status_history_id" UUID NOT NULL,
    "booking_item_id" UUID NOT NULL,
    "action_by_user_id" UUID,
    "old_status" "BookingStatus",
    "new_status" "BookingStatus" NOT NULL,
    "action_type" TEXT NOT NULL,
    "note" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_item_status_histories_pkey" PRIMARY KEY ("booking_item_status_history_id")
);

CREATE TABLE "violations" (
    "violation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_item_id" UUID,
    "violation_type" "ViolationType" NOT NULL,
    "penalty_points" INTEGER NOT NULL,
    "description" TEXT,
    "recorded_by_user_id" UUID,
    "is_waived" BOOLEAN NOT NULL DEFAULT false,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("violation_id")
);

CREATE TABLE "notifications" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_order_id" UUID,
    "booking_item_id" UUID,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

CREATE UNIQUE INDEX "booking_orders_booking_code_key" ON "booking_orders"("booking_code");
CREATE INDEX "booking_orders_user_id_idx" ON "booking_orders"("user_id");
CREATE INDEX "booking_orders_booking_status_idx" ON "booking_orders"("booking_status");
CREATE INDEX "booking_orders_payment_status_idx" ON "booking_orders"("payment_status");

CREATE INDEX "booking_items_booking_order_id_idx" ON "booking_items"("booking_order_id");
CREATE INDEX "booking_items_court_id_start_datetime_end_datetime_idx" ON "booking_items"("court_id", "start_datetime", "end_datetime");
CREATE INDEX "booking_items_booking_status_idx" ON "booking_items"("booking_status");
CREATE INDEX "booking_items_time_range_idx" ON "booking_items" USING GIST ("court_id" gist_uuid_ops, "booking_time_range");

CREATE UNIQUE INDEX "payments_gateway_transaction_id_key" ON "payments"("gateway_transaction_id");
CREATE INDEX "payments_booking_order_id_idx" ON "payments"("booking_order_id");
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

CREATE UNIQUE INDEX "refunds_gateway_refund_id_key" ON "refunds"("gateway_refund_id");
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");
CREATE INDEX "refunds_booking_order_id_idx" ON "refunds"("booking_order_id");
CREATE INDEX "refunds_booking_item_id_idx" ON "refunds"("booking_item_id");
CREATE INDEX "refunds_refund_status_idx" ON "refunds"("refund_status");

CREATE INDEX "booking_order_status_histories_booking_order_id_idx" ON "booking_order_status_histories"("booking_order_id");
CREATE INDEX "booking_order_status_histories_action_by_user_id_idx" ON "booking_order_status_histories"("action_by_user_id");

CREATE INDEX "booking_item_status_histories_booking_item_id_idx" ON "booking_item_status_histories"("booking_item_id");
CREATE INDEX "booking_item_status_histories_action_by_user_id_idx" ON "booking_item_status_histories"("action_by_user_id");

CREATE INDEX "violations_user_id_idx" ON "violations"("user_id");
CREATE INDEX "violations_booking_item_id_idx" ON "violations"("booking_item_id");
CREATE INDEX "violations_recorded_by_user_id_idx" ON "violations"("recorded_by_user_id");

CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");
CREATE INDEX "notifications_booking_order_id_idx" ON "notifications"("booking_order_id");
CREATE INDEX "notifications_booking_item_id_idx" ON "notifications"("booking_item_id");
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_orders" ADD CONSTRAINT "booking_orders_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_order_id_fkey" FOREIGN KEY ("booking_order_id") REFERENCES "booking_orders"("booking_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("court_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_checked_in_by_user_id_fkey" FOREIGN KEY ("checked_in_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_no_show_marked_by_user_id_fkey" FOREIGN KEY ("no_show_marked_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_order_id_fkey" FOREIGN KEY ("booking_order_id") REFERENCES "booking_orders"("booking_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_order_id_fkey" FOREIGN KEY ("booking_order_id") REFERENCES "booking_orders"("booking_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("booking_item_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_user_id_fkey" FOREIGN KEY ("processed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_order_status_histories" ADD CONSTRAINT "booking_order_status_histories_booking_order_id_fkey" FOREIGN KEY ("booking_order_id") REFERENCES "booking_orders"("booking_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_order_status_histories" ADD CONSTRAINT "booking_order_status_histories_action_by_user_id_fkey" FOREIGN KEY ("action_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_item_status_histories" ADD CONSTRAINT "booking_item_status_histories_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("booking_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_item_status_histories" ADD CONSTRAINT "booking_item_status_histories_action_by_user_id_fkey" FOREIGN KEY ("action_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "violations" ADD CONSTRAINT "violations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "violations" ADD CONSTRAINT "violations_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("booking_item_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "violations" ADD CONSTRAINT "violations_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_order_id_fkey" FOREIGN KEY ("booking_order_id") REFERENCES "booking_orders"("booking_order_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("booking_item_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "booking_items"
ADD CONSTRAINT "no_overlapping_active_booking_items"
EXCLUDE USING gist (
  "court_id" WITH =,
  "booking_time_range" WITH &&
)
WHERE ("booking_status" IN ('PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED', 'IN_USE'));
