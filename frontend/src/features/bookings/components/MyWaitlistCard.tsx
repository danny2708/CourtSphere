import { CalendarClock, Clock, MapPin, ShieldCheck, XCircle } from "lucide-react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import type { WaitlistEntry, WaitlistStatus } from "../../courts/services/waitlistService";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const statusCopy: Record<WaitlistStatus, { label: string; tone: "primary" | "success" | "warning" | "danger" | "neutral" }> = {
  WAITING: { label: "Đang chờ", tone: "warning" },
  NOTIFIED: { label: "Đến lượt", tone: "primary" },
  BOOKED: { label: "Đã tạo giữ chỗ", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "neutral" },
  EXPIRED: { label: "Đã hết hạn", tone: "danger" }
};

function canCancel(status: WaitlistStatus): boolean {
  return status === "WAITING" || status === "NOTIFIED";
}

function formatDateTime(value?: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : "Chưa có";
}

type MyWaitlistCardProps = {
  entry: WaitlistEntry;
  isCancelling?: boolean;
  onCancel: (entry: WaitlistEntry) => void;
};

export function MyWaitlistCard({ entry, isCancelling = false, onCancel }: MyWaitlistCardProps) {
  const status = statusCopy[entry.status] ?? statusCopy.WAITING;

  return (
    <Card as="article" className="my-waitlist-card">
      <div className="my-waitlist-card__header">
        <div>
          <p className="eyebrow">Hàng chờ</p>
          <h3>{entry.court.courtName}</h3>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="my-waitlist-card__meta">
        <span>
          <CalendarClock size={16} aria-hidden="true" />
          {formatDateTime(entry.desiredStartDatetime)} - {formatDateTime(entry.desiredEndDatetime)}
        </span>
        <span>
          <MapPin size={16} aria-hidden="true" />
          {entry.court.courtType.typeName}
        </span>
        <span>
          <ShieldCheck size={16} aria-hidden="true" />
          {entry.priorityGroup?.groupName ?? "Nhóm mặc định"}
        </span>
        {entry.expiresAt ? (
          <span>
            <Clock size={16} aria-hidden="true" />
            Hạn phản hồi: {formatDateTime(entry.expiresAt)}
          </span>
        ) : null}
      </div>

      {canCancel(entry.status) ? (
        <div className="my-waitlist-card__actions">
          <Button variant="danger" size="sm" disabled={isCancelling} onClick={() => onCancel(entry)}>
            <XCircle size={16} aria-hidden="true" />
            {isCancelling ? "Đang hủy..." : "Hủy hàng chờ"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
