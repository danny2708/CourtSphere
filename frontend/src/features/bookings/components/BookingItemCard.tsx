import { CalendarDays, Clock, MapPin } from "lucide-react";

import { Card } from "../../../components/common/Card";
import { bookingItemStatusLabel, getStatusLabel } from "../../../utils/status-label";
import type { BookingItem } from "../types/booking.types";
import { BookingStatusBadge } from "./BookingStatusBadge";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit"
});

export function BookingItemCard({ item }: { item: BookingItem }) {
  const startDate = new Date(item.startDatetime);
  const endDate = new Date(item.endDatetime);

  return (
    <Card as="article" className="booking-item-card">
      <div className="booking-item-card__header">
        <div>
          <h3>{item.court.courtName}</h3>
          <p>{item.court.courtType?.typeName ?? "Sân thể thao"}</p>
        </div>
        <BookingStatusBadge status={item.bookingStatus} />
      </div>

      <div className="booking-item-meta">
        <span>
          <CalendarDays aria-hidden="true" size={16} />
          {dateFormatter.format(startDate)}
        </span>
        <span>
          <Clock aria-hidden="true" size={16} />
          {timeFormatter.format(startDate)} - {timeFormatter.format(endDate)}
        </span>
        <span>
          <MapPin aria-hidden="true" size={16} />
          {getStatusLabel(bookingItemStatusLabel, item.bookingStatus)}
        </span>
      </div>

      <strong>{currencyFormatter.format(item.amount)}</strong>
    </Card>
  );
}
