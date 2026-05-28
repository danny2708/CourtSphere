import { Badge } from "../../../components/common/Badge";
import { paymentStatusLabel } from "../../../utils/status-label";
import type { PaymentStatus } from "../types/booking.types";

const statusTone: Record<PaymentStatus, "primary" | "success" | "warning" | "danger" | "neutral"> = {
  INITIATED: "neutral",
  PROCESSING: "warning",
  SUCCESS: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  EXPIRED: "danger"
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={statusTone[status]}>{paymentStatusLabel[status]}</Badge>;
}
