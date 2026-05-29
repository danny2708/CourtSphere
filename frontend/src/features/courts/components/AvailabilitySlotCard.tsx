import { CheckCircle2, Clock, LockKeyhole } from "lucide-react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { availabilitySlotStatusLabel } from "../../../utils/status-label";
import { cn } from "../../../utils/cn";
import type { AvailabilitySlotStatus, AvailabilitySlotViewModel } from "../types/availability.types";

const statusTone: Record<AvailabilitySlotStatus, "success" | "warning" | "danger" | "neutral" | "primary"> = {
  AVAILABLE: "success",
  PENDING_PAYMENT: "warning",
  PAYMENT_PROCESSING: "warning",
  CONFIRMED: "neutral",
  IN_USE: "primary",
  UNAVAILABLE: "danger"
};

type AvailabilitySlotCardProps = {
  slot: AvailabilitySlotViewModel;
  isSelected: boolean;
  onSelect: (slot: AvailabilitySlotViewModel) => void;
};

export function AvailabilitySlotCard({ isSelected, onSelect, slot }: AvailabilitySlotCardProps) {
  const canSelect = slot.isAvailable;

  return (
    <article
      className={cn(
        "availability-slot",
        `availability-slot--${slot.status.toLowerCase().replace("_", "-")}`,
        isSelected && "availability-slot--selected"
      )}
    >
      <div className="availability-slot__header">
        <div>
          <span className="availability-slot__time">
            {slot.startTimeText} - {slot.endTimeText}
          </span>
          <span className="availability-slot__price">{slot.priceText ?? "Chưa có giá"}</span>
        </div>
        <Badge tone={statusTone[slot.status]}>{availabilitySlotStatusLabel[slot.status]}</Badge>
      </div>

      {slot.reasonText ? <p>{slot.reasonText}</p> : <p>Khung giờ có thể chọn để chuẩn bị đặt lịch.</p>}

      <Button
        aria-pressed={isSelected}
        className="availability-slot__button"
        disabled={!canSelect}
        size="sm"
        variant={isSelected ? "secondary" : canSelect ? "primary" : "ghost"}
        onClick={() => onSelect(slot)}
      >
        {isSelected ? (
          <>
            <CheckCircle2 aria-hidden="true" size={16} />
            Đã chọn
          </>
        ) : canSelect ? (
          <>
            <Clock aria-hidden="true" size={16} />
            Chọn khung giờ
          </>
        ) : (
          <>
            <LockKeyhole aria-hidden="true" size={16} />
            Không chọn được
          </>
        )}
      </Button>
    </article>
  );
}
