import { Card } from "../../../components/common/Card";
import type { AvailabilitySlotViewModel } from "../types/availability.types";

type CourtPriceSummaryProps = {
  availableSlotCount: number;
  selectedSlot?: AvailabilitySlotViewModel | null;
  selectedSlots?: AvailabilitySlotViewModel[];
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit"
});

export function CourtPriceSummary({ availableSlotCount, selectedSlot = null, selectedSlots }: CourtPriceSummaryProps) {
  const slots = selectedSlots ?? (selectedSlot ? [selectedSlot] : []);
  const totalAmount = slots.reduce((sum, slot) => sum + (slot.priceAmount ?? 0), 0);
  const selectedText = slots.length
    ? slots.map((slot) => `${shortDateFormatter.format(new Date(slot.startDatetime))} ${slot.startTimeText} - ${slot.endTimeText}`).join(", ")
    : "Chưa chọn";

  return (
    <Card as="section" className="detail-card price-summary">
      <div>
        <p className="eyebrow">Tạm tính</p>
        <h2>{slots.length ? currencyFormatter.format(totalAmount) : "Chọn khung giờ"}</h2>
      </div>

      <dl>
        <div>
          <dt>Khung giờ đã chọn</dt>
          <dd>{selectedText}</dd>
        </div>
        <div>
          <dt>Số slot đã chọn</dt>
          <dd>{slots.length}</dd>
        </div>
        <div>
          <dt>Slot còn trống</dt>
          <dd>{availableSlotCount}</dd>
        </div>
      </dl>
    </Card>
  );
}
