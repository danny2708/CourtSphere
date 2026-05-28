import { CreditCard, ShieldCheck } from "lucide-react";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import type { BookingOrder } from "../types/booking.types";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

type FakePaymentPanelProps = {
  booking: BookingOrder;
  isProcessing: boolean;
  onPay: () => Promise<void>;
};

export function FakePaymentPanel({ booking, isProcessing, onPay }: FakePaymentPanelProps) {
  return (
    <Card as="section" className="fake-payment-panel">
      <div>
        <p className="eyebrow">Thanh toán sandbox</p>
        <h2>{currencyFormatter.format(booking.totalAmount)}</h2>
        <p>Thanh toán 100% để backend chuyển đơn sang xác nhận sau callback mock thành công.</p>
      </div>

      <div className="payment-assurance">
        <ShieldCheck aria-hidden="true" size={20} />
        Không xác nhận booking ở frontend. Trạng thái cuối cùng luôn lấy lại từ backend hoặc mock service sau khi thanh toán.
      </div>

      <Button disabled={isProcessing} size="lg" onClick={onPay}>
        <CreditCard aria-hidden="true" size={18} />
        {isProcessing ? "Đang xử lý..." : "Thanh toán thử"}
      </Button>
    </Card>
  );
}
