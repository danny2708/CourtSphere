import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { buildBookingDetailPath, ROUTE_PATHS } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { BookingItemCard } from "../components/BookingItemCard";
import { BookingStatusBadge } from "../components/BookingStatusBadge";
import { CancelBookingDialog } from "../components/CancelBookingDialog";
import { MomoPaymentPanel } from "../components/MomoPaymentPanel";
import { PaymentStatusBadge } from "../components/PaymentStatusBadge";
import { cancelBooking, getBookingDetail } from "../services/bookingService";
import { cancelPaymentForBooking, createPayment } from "../services/paymentService";
import type { BookingOrder } from "../types/booking.types";

function isPayable(booking: BookingOrder): boolean {
  return booking.bookingStatus === "PENDING_PAYMENT" || booking.bookingStatus === "PAYMENT_PROCESSING";
}

function canCancelBookingRequest(booking: BookingOrder): boolean {
  return booking.bookingStatus === "PENDING_PAYMENT" || booking.bookingStatus === "PAYMENT_PROCESSING";
}

function activePaymentDeadline(booking: BookingOrder): string | null {
  if (booking.bookingStatus !== "PAYMENT_PROCESSING" || booking.paymentStatus !== "PROCESSING" || !booking.holdExpiresAt) {
    return null;
  }

  return new Date(booking.holdExpiresAt) > new Date() ? booking.holdExpiresAt : null;
}

export function PaymentPage() {
  const navigate = useNavigate();
  const { bookingOrderId } = useParams<{ bookingOrderId: string }>();
  const { addToast } = useToastStore();
  const [booking, setBooking] = useState<BookingOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCancelBookingOpen, setIsCancelBookingOpen] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [isCancellingPayment, setIsCancellingPayment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentDeadline, setPaymentDeadline] = useState<string | null>(null);

  const loadBooking = async () => {
    if (!bookingOrderId) {
      setError("Thiếu mã đơn đặt sân.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loadedBooking = await getBookingDetail(bookingOrderId);
      setBooking(loadedBooking);
      setPaymentDeadline(activePaymentDeadline(loadedBooking));
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

    setIsProcessing(true);
    setError(null);

    try {
      const payment = await createPayment(booking.bookingOrderId, {
        amount: booking.totalAmount,
        paymentMethod: "MOMO"
      });
      setPaymentDeadline(payment.bookingOrder?.holdExpiresAt ?? null);

      if (!payment.paymentUrl) {
        throw new Error("MoMo không trả về đường dẫn thanh toán.");
      }

      window.location.assign(payment.paymentUrl);
    } catch (paymentError) {
      setError(getErrorMessage(paymentError));
      setIsProcessing(false);
    } finally {
      if (document.visibilityState === "visible") {
        setIsProcessing(false);
      }
    }
  };

  const handlePaymentDeadlineExpired = useCallback(() => {
    if (!booking) {
      return;
    }

    setIsProcessing(false);
    navigate(buildBookingDetailPath(booking.bookingOrderId), { replace: true });
  }, [booking, navigate]);

  const handleCancelPayment = async () => {
    if (!booking) {
      return;
    }

    setIsCancellingPayment(true);
    setError(null);

    try {
      await cancelPaymentForBooking(booking.bookingOrderId);
      const updatedBooking = await getBookingDetail(booking.bookingOrderId);
      setBooking(updatedBooking);
      setPaymentDeadline(activePaymentDeadline(updatedBooking));
      addToast({ type: "success", title: "Đã hủy phiên thanh toán" });
      navigate(buildBookingDetailPath(booking.bookingOrderId), { replace: true });
    } catch (cancelError) {
      setError(getErrorMessage(cancelError));
    } finally {
      setIsCancellingPayment(false);
    }
  };

  const handleCancelBookingRequest = async (reason?: string) => {
    if (!booking) {
      return;
    }

    setIsCancellingBooking(true);
    setError(null);

    try {
      const updatedBooking = await cancelBooking(booking.bookingOrderId, { reason });
      setBooking(updatedBooking);
      setPaymentDeadline(null);
      setIsCancelBookingOpen(false);
      addToast({ type: "success", title: "Đã hủy yêu cầu đặt sân" });
      navigate(buildBookingDetailPath(booking.bookingOrderId), { replace: true });
    } catch (cancelError) {
      setError(getErrorMessage(cancelError));
    } finally {
      setIsCancellingBooking(false);
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
        <MomoPaymentPanel
          booking={booking}
          canCancelBookingRequest={canCancelBookingRequest(booking)}
          canCancelPayment={booking.paymentStatus === "PROCESSING"}
          isMockBooking={booking.bookingOrderId.startsWith("mock-booking-")}
          isCancellingBooking={isCancellingBooking}
          isCancellingPayment={isCancellingPayment}
          isProcessing={isProcessing}
          paymentDeadline={paymentDeadline}
          onCancelBookingRequest={() => setIsCancelBookingOpen(true)}
          onCancelPayment={handleCancelPayment}
          onPaymentDeadlineExpired={handlePaymentDeadlineExpired}
          onPay={handlePay}
        />
        <div className="booking-side-panel">
          {booking.items.map((item) => (
            <BookingItemCard key={item.bookingItemId} item={item} />
          ))}
        </div>
      </div>

      <CancelBookingDialog
        isOpen={isCancelBookingOpen}
        isSubmitting={isCancellingBooking}
        onCancel={() => setIsCancelBookingOpen(false)}
        onConfirm={handleCancelBookingRequest}
      />
    </section>
  );
}