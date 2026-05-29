import { Card } from "../../../components/common/Card";
import type { AvailabilitySlotViewModel } from "../types/availability.types";

type CourtPriceSummaryProps = {
  selectedSlot: AvailabilitySlotViewModel | null;
  availableSlotCount: number;
};

export function CourtPriceSummary({ availableSlotCount, selectedSlot }: CourtPriceSummaryProps) {
  return (
    <Card as="section" className="detail-card price-summary">
      <div>
        <p className="eyebrow">Tạm tính</p>
        <h2>{selectedSlot?.priceText ?? "Chọn khung giờ"}</h2>
      </div>

      <dl>
        <div>
          <dt>Khung giờ đã chọn</dt>
          <dd>{selectedSlot ? `${selectedSlot.startTimeText} - ${selectedSlot.endTimeText}` : "Chưa chọn"}</dd>
        </div>
        <div>
          <dt>Slot còn trống</dt>
          <dd>{availableSlotCount}</dd>
        </div>
      </dl>
    </Card>
  );
}
