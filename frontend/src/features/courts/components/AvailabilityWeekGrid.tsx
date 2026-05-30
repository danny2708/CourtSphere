import { CheckCircle2, Circle, Clock3, ListPlus, LockKeyhole } from "lucide-react";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { availabilitySlotStatusLabel } from "../../../utils/status-label";
import { cn } from "../../../utils/cn";
import type {
  AvailabilitySlotStatus,
  AvailabilitySlotViewModel,
  CourtAvailabilityViewModel
} from "../types/availability.types";
import { toDateInputValue } from "../utils/dateUtils";

type AvailabilityWeekGridProps = {
  availabilities: CourtAvailabilityViewModel[];
  canJoinWaitlist?: boolean;
  joiningWaitlistSlotId?: string | null;
  selectedDate: string;
  selectedSlotIds: string[];
  visibleEndTime: string;
  visibleStartTime: string;
  weekStartDate: string;
  onJoinWaitlist?: (slot: AvailabilitySlotViewModel) => void;
  onSelectSlot: (slot: AvailabilitySlotViewModel) => void;
};

const statusTone: Record<AvailabilitySlotStatus, "success" | "warning" | "danger" | "neutral" | "primary"> = {
  AVAILABLE: "success",
  PENDING_PAYMENT: "warning",
  PAYMENT_PROCESSING: "warning",
  CONFIRMED: "neutral",
  IN_USE: "primary",
  UNAVAILABLE: "danger"
};

const waitlistableStatuses = new Set<AvailabilitySlotStatus>([
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "IN_USE"
]);

const weekdayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short"
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit"
});

function parseDateInput(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function timeToMinutes(time: string): number {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
}

function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60).toString().padStart(2, "0");
  const minute = (minutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function getStatusIcon(slot: AvailabilitySlotViewModel, isSelected: boolean) {
  if (isSelected) {
    return CheckCircle2;
  }

  if (slot.status === "AVAILABLE") {
    return Circle;
  }

  if (slot.status === "PENDING_PAYMENT" || slot.status === "PAYMENT_PROCESSING") {
    return Clock3;
  }

  return LockKeyhole;
}

export function AvailabilityWeekGrid({
  availabilities,
  canJoinWaitlist = false,
  joiningWaitlistSlotId,
  onJoinWaitlist,
  onSelectSlot,
  selectedDate,
  selectedSlotIds,
  visibleEndTime,
  visibleStartTime,
  weekStartDate
}: AvailabilityWeekGridProps) {
  const weekStart = parseDateInput(weekStartDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      date,
      key: toDateInputValue(date),
      label: weekdayFormatter.format(date),
      subLabel: dateFormatter.format(date)
    };
  });
  const selectedDay = days.find((day) => day.key === selectedDate) ?? days[0];
  const startMinutes = timeToMinutes(visibleStartTime);
  const endMinutes = timeToMinutes(visibleEndTime);
  const slotByDateAndTime = new Map<string, AvailabilitySlotViewModel>();
  const slotStartTimes = new Set<string>();

  availabilities.forEach((availability) => {
    availability.slots.forEach((slot) => {
      slotByDateAndTime.set(`${availability.date}|${slot.startTimeText}`, slot);
      if (timeToMinutes(slot.startTimeText) >= startMinutes && timeToMinutes(slot.startTimeText) < endMinutes) {
        slotStartTimes.add(slot.startTimeText);
      }
    });
  });
  const rowStepMinutes =
    Math.min(...availabilities.map((availability) => availability.durationMinutes ?? 60).filter((value) => value > 0)) || 60;
  const generatedRows = startMinutes < endMinutes
    ? Array.from({ length: Math.ceil((endMinutes - startMinutes) / rowStepMinutes) }, (_, index) =>
        minutesToTime(startMinutes + index * rowStepMinutes)
      ).filter((time) => timeToMinutes(time) < endMinutes)
    : [];
  const rows = Array.from(new Set([...generatedRows, ...slotStartTimes])).sort(
    (left, right) => timeToMinutes(left) - timeToMinutes(right)
  );

  if (rows.length === 0) {
    return (
      <div className="availability-week-empty" role="status">
        Vui lòng chọn khoảng giờ hiển thị hợp lệ.
      </div>
    );
  }

  const renderClosedCell = (key: string, time?: string) => (
    <div className="availability-week-cell availability-week-cell--closed" key={key}>
      <LockKeyhole aria-hidden="true" size={16} />
      {time ? <span className="availability-week-cell__time">{time}</span> : null}
      <strong>Đóng cửa</strong>
      <span>Không có slot</span>
    </div>
  );

  const renderSlotCell = (slot: AvailabilitySlotViewModel, className?: string) => {
    const isSelected = selectedSlotIds.includes(slot.id);
    const StatusIcon = getStatusIcon(slot, isSelected);
    const canJoinSlotWaitlist =
      !slot.isAvailable && canJoinWaitlist && waitlistableStatuses.has(slot.status) && Boolean(onJoinWaitlist);

    return (
      <div
        className={cn(
          "availability-week-cell",
          `availability-week-cell--${slot.status.toLowerCase().replace("_", "-")}`,
          isSelected && "availability-week-cell--selected",
          className
        )}
        key={slot.id}
      >
        <button
          aria-pressed={isSelected}
          className="availability-week-slot"
          disabled={!slot.isAvailable}
          type="button"
          onClick={() => onSelectSlot(slot)}
        >
          <span className="availability-week-slot__meta">
            <StatusIcon aria-hidden="true" size={17} />
            <strong>{slot.startTimeText} - {slot.endTimeText}</strong>
          </span>
          <span className="availability-week-slot__price">{slot.priceText ?? "Chưa có giá"}</span>
          <Badge tone={isSelected ? "primary" : statusTone[slot.status]}>
            {isSelected ? "Đã chọn" : availabilitySlotStatusLabel[slot.status]}
          </Badge>
        </button>
        {canJoinSlotWaitlist ? (
          <Button
            className="availability-week-waitlist"
            disabled={joiningWaitlistSlotId === slot.id}
            size="sm"
            variant="secondary"
            onClick={() => onJoinWaitlist?.(slot)}
          >
            <ListPlus aria-hidden="true" size={15} />
            {joiningWaitlistSlotId === slot.id ? "Đang vào..." : "Hàng chờ"}
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="availability-week-wrap">
      <div className="availability-week-grid">
        <div className="availability-week-head availability-week-head--time">Giờ</div>
        {days.map((day) => (
          <div className="availability-week-head" key={day.key}>
            <strong>{day.label}</strong>
            <span>{day.subLabel}</span>
          </div>
        ))}

        {rows.map((time) => (
          <div className="availability-week-row" key={time}>
            <div className="availability-week-time">{time}</div>
            {days.map((day) => {
              const slot = slotByDateAndTime.get(`${day.key}|${time}`);

              if (!slot) {
                return renderClosedCell(`${day.key}-${time}`);
              }

              return renderSlotCell(slot);
            })}
          </div>
        ))}
      </div>

      <div className="availability-week-mobile">
        {[selectedDay].map((day) => (
          <section className="availability-week-mobile-day" key={day.key}>
            <header className="availability-week-mobile-day__header">
              <strong>{day.label}</strong>
              <span>{day.subLabel}</span>
            </header>
            <div className="availability-week-mobile-day__slots">
              {rows.map((time) => {
                const slot = slotByDateAndTime.get(`${day.key}|${time}`);

                return slot
                  ? renderSlotCell(slot, "availability-week-cell--mobile")
                  : renderClosedCell(`${day.key}-${time}-mobile`, time);
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
