import { Badge } from "../../../components/common/Badge";
import { bookingOrderStatusLabel, getStatusLabel } from "../../../utils/status-label";
import type { BookingStatus } from "../types/booking.types";

const statusTone: Record<string, "primary" | "success" | "warning" | "danger" | "neutral"> = {
  PENDING_PAYMENT: "warning",
  PAYMENT_PROCESSING: "warning",
  CONFIRMED: "success",
  IN_USE: "primary",
  COMPLETED: "neutral",
  PAYMENT_EXPIRED: "danger",
  CANCELLED_BY_USER: "neutral",
  CANCELLED_BY_MANAGER: "neutral",
  CANCELLED_BY_ADMIN: "neutral",
  CHECKIN_EXPIRED: "danger",
  NO_SHOW: "danger"
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={statusTone[status] ?? "neutral"}>{getStatusLabel(bookingOrderStatusLabel, status)}</Badge>;
}
