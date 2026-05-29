import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { LoadingState } from "../../../components/common/LoadingState";
import { buildBookingDetailPath, ROUTE_PATHS } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { getBookingDetail } from "../services/bookingService";
import { handleMomoPaymentReturn } from "../services/paymentService";
import type { PaymentDetail } from "../types/payment.types";

function paramsToRecord(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search).entries());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function bookingOrderIdFromExtraData(extraData: string | undefined): string | null {
  if (!extraData) {
    return null;
  }

  try {
    const parsed = JSON.parse(window.atob(extraData)) as { bookingOrderId?: unknown };
    return typeof parsed.bookingOrderId === "string" ? parsed.bookingOrderId : null;
  } catch {
    return null;
  }
}

export function MomoPaymentReturnPage() {
  const location = useLocation();
  const { addToast } = useToastStore();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payload = useMemo(() => paramsToRecord(location.search), [location.search]);
  const fallbackBookingOrderId = useMemo(() => bookingOrderIdFromExtraData(payload.extraData), [payload.extraData]);

  useEffect(() => {
    let isMounted = true;

    async function waitForConfirmedBooking(bookingOrderId: string): Promise<boolean> {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const booking = await getBookingDetail(bookingOrderId);

        if (booking.paymentStatus === "SUCCESS" && booking.bookingStatus === "CONFIRMED") {
          return true;
        }

        await sleep(700);
      }

      return false;
    }

    async function confirmPaymentResult() {
      if (!payload.orderId || !payload.signature) {
        setError("Thiếu dữ liệu phản hồi từ MoMo.");
        return;
      }

      try {
        const confirmedPayment = await handleMomoPaymentReturn(payload);
        const bookingOrderId = confirmedPayment.bookingOrder?.bookingOrderId ?? fallbackBookingOrderId;
        const isConfirmed =
          confirmedPayment.paymentStatus === "SUCCESS" ||
          (bookingOrderId ? await waitForConfirmedBooking(bookingOrderId) : false);

        if (!isMounted) {
          return;
        }

        setPayment(confirmedPayment);
        setIsConfirmed(isConfirmed);
        addToast({
          type: isConfirmed ? "success" : "warning",
          title: isConfirmed ? "Thanh toán thành công" : "Thanh toán chưa hoàn tất",
          message: confirmedPayment.bookingOrder?.bookingCode ?? "Đã nhận kết quả từ MoMo."
        });
      } catch (confirmError) {
        const bookingOrderId = fallbackBookingOrderId;

        if (bookingOrderId) {
          try {
            const isConfirmed = await waitForConfirmedBooking(bookingOrderId);

            if (isConfirmed && isMounted) {
              setIsConfirmed(true);
              setPayment({
                id: payload.orderId,
                amount: Number(payload.amount ?? 0),
                paymentMethod: "MOMO",
                gatewayTransactionId: payload.orderId,
                paymentStatus: "SUCCESS",
                bookingOrder: {
                  id: bookingOrderId,
                  bookingOrderId,
                  bookingCode: payload.orderInfo ?? bookingOrderId,
                  bookingStatus: "CONFIRMED",
                  paymentStatus: "SUCCESS",
                  totalAmount: Number(payload.amount ?? 0),
                  items: []
                }
              });
              addToast({
                type: "success",
                title: "Thanh toán thành công",
                message: payload.orderInfo ?? "Đã nhận kết quả từ MoMo."
              });
              return;
            }
          } catch {
            // Fall through to the original callback error below.
          }
        }

        if (isMounted) {
          setError(getErrorMessage(confirmError));
        }
      }
    }

    void confirmPaymentResult();

    return () => {
      isMounted = false;
    };
  }, [addToast, fallbackBookingOrderId, payload]);

  if (!payment && !error) {
    return <LoadingState title="Đang xác nhận thanh toán" message="Đang kiểm tra kết quả từ MoMo..." />;
  }

  const bookingOrderId = payment?.bookingOrder?.bookingOrderId ?? fallbackBookingOrderId;
  const isSuccess = isConfirmed || payment?.paymentStatus === "SUCCESS";

  return (
    <section className="page-stack payment-return-page">
      <div className="payment-return-panel">
        {isSuccess ? <CheckCircle2 aria-hidden="true" size={42} /> : <XCircle aria-hidden="true" size={42} />}
        <div>
          <p className="eyebrow">MoMo sandbox</p>
          <h1>{isSuccess ? "Thanh toán thành công" : "Thanh toán chưa hoàn tất"}</h1>
          <p>{error ?? `Trạng thái thanh toán: ${payment?.paymentStatus ?? "UNKNOWN"}`}</p>
        </div>
        <div className="detail-actions-stack">
          {bookingOrderId ? (
            <Link className="ui-button ui-button--primary ui-button--lg" to={buildBookingDetailPath(bookingOrderId)}>
              Xem chi tiết đơn
            </Link>
          ) : null}
          <Link className="ui-button ui-button--secondary ui-button--lg" to={ROUTE_PATHS.myBookings}>
            Về đơn của tôi
          </Link>
        </div>
      </div>
    </section>
  );
}
