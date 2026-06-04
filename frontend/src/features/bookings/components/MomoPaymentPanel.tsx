import { useEffect, useRef, useState } from "react";
import { Clock3, ExternalLink, RotateCcw, ShieldCheck, WalletCards, XCircle } from "lucide-react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import type { BookingOrder } from "../types/booking.types";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

type MomoPaymentPanelProps = {
  booking: BookingOrder;
  isProcessing: boolean;
  isMockBooking: boolean;
  isCancellingPayment?: boolean;
  isCancellingBooking?: boolean;
  canCancelPayment?: boolean;
  canCancelBookingRequest?: boolean;
  paymentDeadline?: string | null;
  onPaymentDeadlineExpired?: () => void;
  onCancelPayment?: () => Promise<void>;
  onCancelBookingRequest?: () => void;
  onPay: () => Promise<void>;
};

function getRemainingSeconds(deadline?: string | null): number {
  if (!deadline) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
}

function formatRemainingTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}

export function MomoPaymentPanel({
  booking,
  canCancelBookingRequest = false,
  canCancelPayment = false,
  isCancellingBooking = false,
  isCancellingPayment = false,
  isMockBooking,
  isProcessing,
  onCancelBookingRequest,
  onCancelPayment,
  paymentDeadline,
  onPaymentDeadlineExpired,
  onPay
}: MomoPaymentPanelProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(paymentDeadline));
  const expiredCallbackCalled = useRef(false);

  useEffect(() => {
    expiredCallbackCalled.current = false;

    const updateCountdown = () => {
      const nextRemainingSeconds = getRemainingSeconds(paymentDeadline);
      setRemainingSeconds(nextRemainingSeconds);

      if (paymentDeadline && nextRemainingSeconds <= 0 && !expiredCallbackCalled.current) {
        expiredCallbackCalled.current = true;
        onPaymentDeadlineExpired?.();
      }
    };

    updateCountdown();

    if (!paymentDeadline) {
      return undefined;
    }

    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [paymentDeadline, onPaymentDeadlineExpired]);

  const hasActiveCountdown = Boolean(paymentDeadline && remainingSeconds > 0);
  const isDeadlineExpired = Boolean(paymentDeadline && remainingSeconds <= 0);

  return (
    <Card as="section" className="momo-payment-panel">
      <div>
        <p className="eyebrow">MoMo sandbox</p>
        <h2>{currencyFormatter.format(booking.totalAmount)}</h2>
        <p>Thanh toán qua ví MoMo để xác nhận đơn đặt sân.</p>
      </div>

      {hasActiveCountdown ? (
        <div className="payment-countdown" aria-live="polite">
          <Clock3 aria-hidden="true" size={22} />
          <div>
            <span>Hạn thanh toán phiên này</span>
            <strong>{formatRemainingTime(remainingSeconds)}</strong>
          </div>
        </div>
      ) : null}

      <div className="payment-assurance">
        <ShieldCheck aria-hidden="true" size={20} />
        Trạng thái đơn sẽ được cập nhật sau khi MoMo trả kết quả hợp lệ.
      </div>

      {isMockBooking ? (
        <p className="form-alert" role="alert">
          Đơn này chỉ là dữ liệu mock trong trình duyệt. Hãy tạo đơn từ sân thật để thanh toán qua MoMo.
        </p>
      ) : null}

      <div className="momo-payment-panel__actions">
        <Button disabled={isProcessing || isMockBooking || isDeadlineExpired || isCancellingBooking} size="lg" onClick={onPay}>
          {isProcessing ? <ExternalLink aria-hidden="true" size={18} /> : <WalletCards aria-hidden="true" size={18} />}
          {isProcessing ? "Đang mở MoMo..." : "Thanh toán bằng MoMo"}
        </Button>

        {canCancelPayment ? (
          <Button disabled={isCancellingPayment || isProcessing} size="lg" variant="secondary" onClick={onCancelPayment}>
            <XCircle aria-hidden="true" size={18} />
            {isCancellingPayment ? "Đang hủy thanh toán..." : "Hủy thanh toán"}
          </Button>
        ) : null}

        {canCancelBookingRequest ? (
          <Button disabled={isCancellingBooking || isProcessing} size="lg" variant="danger" onClick={onCancelBookingRequest}>
            <RotateCcw aria-hidden="true" size={18} />
            {isCancellingBooking ? "Đang hủy yêu cầu..." : "Hủy yêu cầu đặt sân"}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
