import { EmptyState } from "../../../components/common/EmptyState";
import type { AvailabilitySlotViewModel } from "../types/availability.types";
import { AvailabilitySlotCard } from "./AvailabilitySlotCard";

type AvailabilitySlotPickerProps = {
  slots: AvailabilitySlotViewModel[];
  selectedSlotId: string | null;
  onSelectSlot: (slot: AvailabilitySlotViewModel) => void;
};

export function AvailabilitySlotPicker({ onSelectSlot, selectedSlotId, slots }: AvailabilitySlotPickerProps) {
  if (slots.length === 0) {
    return (
      <EmptyState
        compact
        message="Hôm nay sân chưa có khung giờ hoạt động."
        title="Chưa có lịch trống"
      />
    );
  }

  return (
    <div className="availability-slot-grid">
      {slots.map((slot) => (
        <AvailabilitySlotCard
          key={slot.id}
          isSelected={selectedSlotId === slot.id}
          slot={slot}
          onSelect={onSelectSlot}
        />
      ))}
    </div>
  );
}
