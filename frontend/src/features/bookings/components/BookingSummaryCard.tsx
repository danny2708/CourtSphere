import { Card } from "../../../components/common/Card";
import type { AvailabilityPolicyViewModel, AvailabilitySlotViewModel } from "../../courts/types/availability.types";
import type { CourtDetailViewModel } from "../../courts/types/court-detail.types";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

type BookingSummaryCardProps = {
  court: CourtDetailViewModel | null;
  slot: AvailabilitySlotViewModel | null;
  policy?: AvailabilityPolicyViewModel;
};

export function BookingSummaryCard({ court, policy, slot }: BookingSummaryCardProps) {
  const startDate = slot ? new Date(slot.startDatetime) : null;

  return (
    <Card as="section" className="booking-summary-card">
      <p className="eyebrow">Tóm tắt đặt sân</p>
      <h2>{court?.name ?? "Chưa chọn sân"}</h2>

      <dl>
        <div>
          <dt>Ngày</dt>
          <dd>{startDate ? dateFormatter.format(startDate) : "Chưa chọn"}</dd>
        </div>
        <div>
          <dt>Khung giờ</dt>
          <dd>{slot ? `${slot.startTimeText} - ${slot.endTimeText}` : "Chưa chọn"}</dd>
        </div>
        <div>
          <dt>Giá</dt>
          <dd>{slot?.priceText ?? (slot?.priceAmount ? currencyFormatter.format(slot.priceAmount) : "Chưa có giá")}</dd>
        </div>
        <div>
          <dt>Giữ chỗ thanh toán</dt>
          <dd>{policy?.holdMinutes ? `${policy.holdMinutes} phút` : "Theo cấu hình"}</dd>
        </div>
        <div>
          <dt>Hủy đúng hạn trước</dt>
          <dd>{policy?.cancelBeforeHours ? `${policy.cancelBeforeHours} giờ` : "Theo cấu hình"}</dd>
        </div>
      </dl>
    </Card>
  );
}
