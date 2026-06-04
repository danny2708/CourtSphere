import { useEffect, useState } from "react";
import { ArrowLeft, CreditCard, RotateCcw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { buildBookingPaymentPath, ROUTE_PATHS } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { BookingItemCard } from "../components/BookingItemCard";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { BookingTimeline } from "../components/BookingTimeline";
import { CancelBookingDialog } from "../components/CancelBookingDialog";
import { PaymentStatusBadge } from "../components/PaymentStatusBadge";
import { cancelBooking, getBookingDetail } from "../services/bookingService";
import type { BookingOrder } from "../types/booking.types";

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

function canCancel(booking: BookingOrder): boolean {
  return booking.bookingStatus === "PENDING_PAYMENT" || booking.bookingStatus === "PAYMENT_PROCESSING" || booking.bookingStatus === "CONFIRMED";
}

export function BookingDetailPage() {
  const navigate = useNavigate();
  const { bookingOrderId } = useParams<{ bookingOrderId: string }>();
  const { addToast } = useToastStore();
  const [booking, setBooking] = useState<BookingOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadBooking = async () => {
    if (!bookingOrderId) {
      setError("Thiếu mã đơn đặt sân.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setBooking(await getBookingDetail(bookingOrderId));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBooking();
  }, [bookingOrderId]);

  const handleCancel = async (reason?: string) => {
    if (!booking) {
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      const updatedBooking = await cancelBooking(booking.bookingOrderId, { reason });
      setBooking(updatedBooking);
      setIsCancelOpen(false);
      addToast({ type: "success", title: "Đã hủy đơn đặt sân" });
    } catch (cancelError) {
      setError(getErrorMessage(cancelError));
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return <LoadingState title="Chi tiết đơn" message="Đang tải đơn đặt sân..." />;
  }

  if (error && !booking) {
    return (
      <ErrorState
        title="Không tải được đơn"
        message={error}
        actionLabel="Về đơn của tôi"
        onAction={() => navigate(ROUTE_PATHS.myBookings)}
      />
    );
  }

  if (!booking) {
    return null;
  }

  return (
    <section className="page-stack">
      <Link className="ui-button ui-button--ghost ui-button--md" to={ROUTE_PATHS.myBookings}>
        <ArrowLeft aria-hidden="true" size={18} />
        Về đơn của tôi
      </Link>

      <div className="booking-detail-header">
        <div>
          <p className="eyebrow">{booking.bookingCode}</p>
          <h1>Chi tiết đơn đặt sân</h1>
        </div>
        <div className="status-pair">
          <BookingStatusBadge status={booking.bookingStatus} />
          <PaymentStatusBadge status={booking.paymentStatus} />
        </div>
      </div>

      {error ? <p className="form-alert" role="alert">{error}</p> : null}

      <div className="booking-detail-layout">
        <div className="booking-detail-main">
          {booking.items.map((item) => (
            <BookingItemCard key={item.bookingItemId} item={item} />
          ))}

          <Card as="section" className="detail-card">
            <h2>Lịch sử trạng thái</h2>
            <BookingTimeline histories={booking.statusHistories ?? []} />
          </Card>
        </div>

        <aside className="booking-side-panel">
          <Card as="section" className="detail-card booking-facts">
            <h2>Tổng quan</h2>
            <dl>
              <div>
                <dt>Tổng tiền</dt>
                <dd>{currencyFormatter.format(booking.totalAmount)}</dd>
              </div>
              <div>
                <dt>Hạn thanh toán</dt>
                <dd>{booking.holdExpiresAt ? dateTimeFormatter.format(new Date(booking.holdExpiresAt)) : "Không áp dụng"}</dd>
              </div>
              <div>
                <dt>Ghi chú</dt>
                <dd>{booking.note ?? "Không có"}</dd>
              </div>
              <div>
                <dt>Lý do hủy</dt>
                <dd>{booking.cancelReason ?? "Không có"}</dd>
              </div>
            </dl>
          </Card>

          <div className="detail-actions-stack">
            {canPay(booking) ? (
              <Link className="ui-button ui-button--primary ui-button--lg" to={buildBookingPaymentPath(booking.bookingOrderId)}>
                <CreditCard aria-hidden="true" size={18} />
                Thanh toán
              </Link>
            ) : null}
            {canCancel(booking) ? (
              <Button variant="danger" size="lg" onClick={() => setIsCancelOpen(true)}>
                <RotateCcw aria-hidden="true" size={18} />
                Hủy đơn
              </Button>
            ) : null}
          </div>
        </aside>
      </div>

      <CancelBookingDialog
        isOpen={isCancelOpen}
        isSubmitting={isCancelling}
        onCancel={() => setIsCancelOpen(false)}
        onConfirm={handleCancel}
      />
    </section>
  );
}
