import { ExternalLink, ShieldCheck, WalletCards } from "lucide-react";

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
  onPay: () => Promise<void>;
};

export function MomoPaymentPanel({ booking, isMockBooking, isProcessing, onPay }: MomoPaymentPanelProps) {
  return (
    <Card as="section" className="momo-payment-panel">
      <div>
        <p className="eyebrow">MoMo sandbox</p>
        <h2>{currencyFormatter.format(booking.totalAmount)}</h2>
        <p>Thanh toán qua ví MoMo để xác nhận đơn đặt sân.</p>
      </div>

      <div className="payment-assurance">
        <ShieldCheck aria-hidden="true" size={20} />
        Trạng thái đơn sẽ được cập nhật sau khi MoMo trả kết quả hợp lệ.
      </div>

      {isMockBooking ? (
        <p className="form-alert" role="alert">
          Đơn này chỉ là dữ liệu mock trong trình duyệt. Hãy tạo đơn từ sân thật để thanh toán qua MoMo.
        </p>
      ) : null}

      <Button disabled={isProcessing || isMockBooking} size="lg" onClick={onPay}>
        {isProcessing ? <ExternalLink aria-hidden="true" size={18} /> : <WalletCards aria-hidden="true" size={18} />}
        {isProcessing ? "Đang mở MoMo..." : "Thanh toán bằng MoMo"}
      </Button>
    </Card>
  );
}
