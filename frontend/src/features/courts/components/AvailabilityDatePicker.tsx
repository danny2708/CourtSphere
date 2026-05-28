import { CalendarDays } from "lucide-react";

type AvailabilityDatePickerProps = {
  minDate: string;
  value: string;
  error?: string | null;
  onChange: (date: string) => void;
};

export function AvailabilityDatePicker({ error, minDate, onChange, value }: AvailabilityDatePickerProps) {
  return (
    <label className="availability-date-picker">
      <span>
        <CalendarDays aria-hidden="true" size={18} />
        Chọn ngày xem lịch
      </span>
      <input
        min={minDate}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <small>{error}</small> : null}
    </label>
  );
}
