import { AlertTriangle, CalendarDays, Clock, CreditCard, MapPin, UserRound } from "lucide-react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { BookingStatusBadge } from "../../bookings/components/BookingStatusBadge";
import { PaymentStatusBadge } from "../../bookings/components/PaymentStatusBadge";
import type { ManagerBookingItemViewModel } from "../types/manager.types";

type ManagerBookingItemCardProps = {
  item: ManagerBookingItemViewModel;
  onCancelBooking?: (item: ManagerBookingItemViewModel) => void;
  onCheckIn?: (item: ManagerBookingItemViewModel) => void;
  onNoShow?: (item: ManagerBookingItemViewModel) => void;
  onOverrideCheckIn?: (item: ManagerBookingItemViewModel) => void;
  onOverrideComplete?: (item: ManagerBookingItemViewModel) => void;
};

function isPastEnd(item: ManagerBookingItemViewModel): boolean {
  return new Date(item.endDatetime).getTime() < Date.now();
}

export function ManagerBookingItemCard({
  item,
  onCancelBooking,
  onCheckIn,
  onNoShow,
  onOverrideCheckIn,
  onOverrideComplete
}: ManagerBookingItemCardProps) {
  return (
    <Card as="article" className="manager-booking-card">
      <div className="manager-booking-card__header">
        <div>
          <p className="eyebrow">{item.bookingCode ?? "Booking item"}</p>
          <h3>{item.courtName ?? "Sân thể thao"}</h3>
          <p>{item.courtTypeName ?? "Loại sân"}</p>
        </div>
        <BookingStatusBadge status={item.status} />
      </div>

      <div className="manager-booking-meta">
        <span>
          <UserRound aria-hidden="true" size={16} />
          {item.userName ?? "Người đặt"}
        </span>
        <span>
          <CalendarDays aria-hidden="true" size={16} />
          {item.dateText}
        </span>
        <span>
          <Clock aria-hidden="true" size={16} />
          {item.startTimeText} - {item.endTimeText}
        </span>
        <span>
          <MapPin aria-hidden="true" size={16} />
          {item.courtName ?? item.courtId}
        </span>
        {item.paymentStatus ? (
          <span>
            <CreditCard aria-hidden="true" size={16} />
            <PaymentStatusBadge status={item.paymentStatus} />
          </span>
        ) : null}
      </div>

      {item.status === "IN_USE" && isPastEnd(item) ? (
        <Badge tone="warning" className="manager-card-alert">
          <AlertTriangle aria-hidden="true" size={14} />
          Đã quá giờ kết thúc, hệ thống thường tự hoàn thành. Chỉ override khi có ngoại lệ.
        </Badge>
      ) : null}

      <div className="manager-card-actions">
        <Button disabled={item.status !== "CONFIRMED"} size="sm" onClick={() => onCheckIn?.(item)}>
          Check-in
        </Button>
        <Button disabled={item.status !== "CHECKIN_EXPIRED"} size="sm" variant="secondary" onClick={() => onOverrideCheckIn?.(item)}>
          Override check-in
        </Button>
        <Button disabled={item.status !== "CHECKIN_EXPIRED"} size="sm" variant="danger" onClick={() => onNoShow?.(item)}>
          No-show
        </Button>
        <Button disabled={item.status !== "IN_USE"} size="sm" variant="secondary" onClick={() => onOverrideComplete?.(item)}>
          Override complete
        </Button>
        <Button
          disabled={item.status !== "CONFIRMED" && item.status !== "IN_USE"}
          size="sm"
          variant="ghost"
          onClick={() => onCancelBooking?.(item)}
        >
          Hủy do sự cố
        </Button>
      </div>
    </Card>
  );
}
