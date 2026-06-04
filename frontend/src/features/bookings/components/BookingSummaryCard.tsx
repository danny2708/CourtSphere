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
  slot?: AvailabilitySlotViewModel | null;
  slots?: AvailabilitySlotViewModel[];
  policy?: AvailabilityPolicyViewModel;
};

export function BookingSummaryCard({ court, policy, slot = null, slots }: BookingSummaryCardProps) {
  const selectedSlots = slots ?? (slot ? [slot] : []);
  const firstSlot = selectedSlots[0] ?? null;
  const startDate = firstSlot ? new Date(firstSlot.startDatetime) : null;
  const totalAmount = selectedSlots.reduce((sum, currentSlot) => sum + (currentSlot.priceAmount ?? 0), 0);
  const selectedDateText = selectedSlots.length
    ? Array.from(new Set(selectedSlots.map((currentSlot) => dateFormatter.format(new Date(currentSlot.startDatetime))))).join(", ")
    : "Chưa chọn";

  return (
    <Card as="section" className="booking-summary-card">
      <p className="eyebrow">Tóm tắt đặt sân</p>
      <h2>{court?.name ?? "Chưa chọn sân"}</h2>

      <dl>
        <div>
          <dt>Ngày</dt>
          <dd>{startDate ? selectedDateText : "Chưa chọn"}</dd>
        </div>
        <div>
          <dt>Khung giờ</dt>
          <dd>
            {selectedSlots.length
              ? selectedSlots
                  .map((currentSlot) => `${dateFormatter.format(new Date(currentSlot.startDatetime))} ${currentSlot.startTimeText} - ${currentSlot.endTimeText}`)
                  .join(", ")
              : "Chưa chọn"}
          </dd>
        </div>
        <div>
          <dt>Giá</dt>
          <dd>{selectedSlots.length ? currencyFormatter.format(totalAmount) : "Chưa có giá"}</dd>
        </div>
        <div>
          <dt>Số slot</dt>
          <dd>{selectedSlots.length}</dd>
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
