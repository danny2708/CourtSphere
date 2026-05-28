import { Link } from "react-router-dom";

import { Card } from "../../../components/common/Card";
import { buildBookingDetailPath, buildBookingPaymentPath } from "../../../routes/route-paths";
import type { BookingOrder } from "../types/booking.types";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function canPay(booking: BookingOrder): boolean {
  return booking.bookingStatus === "PENDING_PAYMENT" || booking.bookingStatus === "PAYMENT_PROCESSING";
}

export function MyBookingCard({ booking }: { booking: BookingOrder }) {
  const firstItem = booking.items[0];

  return (
    <Card as="article" className="my-booking-card">
      <div className="my-booking-card__header">
        <div>
          <p className="eyebrow">{booking.bookingCode}</p>
          <h3>{firstItem?.court.courtName ?? "Đơn đặt sân"}</h3>
        </div>
        <div className="status-pair">
          <BookingStatusBadge status={booking.bookingStatus} />
          <PaymentStatusBadge status={booking.paymentStatus} />
        </div>
      </div>

      <div className="my-booking-card__meta">
        <span>{firstItem ? dateTimeFormatter.format(new Date(firstItem.startDatetime)) : "Chưa có khung giờ"}</span>
        <strong>{currencyFormatter.format(booking.totalAmount)}</strong>
      </div>

      <div className="my-booking-card__actions">
        <Link className="ui-button ui-button--secondary ui-button--md" to={buildBookingDetailPath(booking.bookingOrderId)}>
          Xem chi tiết
        </Link>
        {canPay(booking) ? (
          <Link className="ui-button ui-button--primary ui-button--md" to={buildBookingPaymentPath(booking.bookingOrderId)}>
            Thanh toán
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
