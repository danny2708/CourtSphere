import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { buildBookingDetailPath, ROUTE_PATHS } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { BookingItemCard } from "../components/BookingItemCard";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { FakePaymentPanel } from "../components/FakePaymentPanel";
import { PaymentStatusBadge } from "../components/PaymentStatusBadge";
import { getBookingDetail } from "../services/bookingService";
import { confirmMockPaymentSuccess, createPayment } from "../services/paymentService";
import type { BookingOrder } from "../types/booking.types";

function isPayable(booking: BookingOrder): boolean {
  return booking.bookingStatus === "PENDING_PAYMENT" || booking.bookingStatus === "PAYMENT_PROCESSING";
}

function isHoldExpired(booking: BookingOrder): boolean {
  return Boolean(booking.holdExpiresAt && new Date(booking.holdExpiresAt) <= new Date());
}

export function PaymentPage() {
  const navigate = useNavigate();
  const { bookingOrderId } = useParams<{ bookingOrderId: string }>();
  const { addToast } = useToastStore();
  const [booking, setBooking] = useState<BookingOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handlePay = async () => {
    if (!booking) {
      return;
    }

    if (!isPayable(booking)) {
      setError("Đơn đặt sân không còn ở trạng thái có thể thanh toán.");
      return;
    }

    if (isHoldExpired(booking)) {
      setError("Đơn đặt sân đã hết hạn thanh toán.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const payment = await createPayment(booking.bookingOrderId, { amount: booking.totalAmount });
      await confirmMockPaymentSuccess(payment);
      addToast({ type: "success", title: "Thanh toán thành công", message: "Đơn đặt sân đã được xác nhận." });
      await loadBooking();
    } catch (paymentError) {
      setError(getErrorMessage(paymentError));
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <LoadingState title="Thanh toán" message="Đang tải đơn đặt sân..." />;
  }

  if (error && !booking) {
    return (
      <ErrorState
        actionLabel="Về đơn của tôi"
        message={error}
        title="Không tải được thanh toán"
        onAction={() => navigate(ROUTE_PATHS.myBookings)}
      />
    );
  }

  if (!booking) {
    return null;
  }

  return (
    <section className="page-stack">
      <Link className="ui-button ui-button--ghost ui-button--md" to={buildBookingDetailPath(booking.bookingOrderId)}>
        <ArrowLeft aria-hidden="true" size={18} />
        Về chi tiết đơn
      </Link>

      <div className="booking-detail-header">
        <div>
          <p className="eyebrow">{booking.bookingCode}</p>
          <h1>Thanh toán đơn đặt sân</h1>
        </div>
        <div className="status-pair">
          <BookingStatusBadge status={booking.bookingStatus} />
          <PaymentStatusBadge status={booking.paymentStatus} />
        </div>
      </div>

      {error ? <p className="form-alert" role="alert">{error}</p> : null}

      <div className="booking-create-layout">
        <FakePaymentPanel booking={booking} isProcessing={isProcessing} onPay={handlePay} />
        <div className="booking-side-panel">
          {booking.items.map((item) => (
            <BookingItemCard key={item.bookingItemId} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
