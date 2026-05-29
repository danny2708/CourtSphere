import type { ManagerCourtViewModel, ManagerScheduleFilterState } from "../types/manager.types";

type ManagerScheduleFiltersProps = {
  courts: ManagerCourtViewModel[];
  value: ManagerScheduleFilterState;
  onChange: (value: ManagerScheduleFilterState) => void;
};

export function ManagerScheduleFilters({ courts, onChange, value }: ManagerScheduleFiltersProps) {
  return (
    <div className="manager-filters">
      <label>
        <span>Tìm booking</span>
        <input
          placeholder="Mã đơn, người đặt, sân..."
          type="search"
          value={value.keyword}
          onChange={(event) => onChange({ ...value, keyword: event.target.value })}
        />
      </label>

      <label>
        <span>Sân</span>
        <select value={value.courtId} onChange={(event) => onChange({ ...value, courtId: event.target.value })}>
          <option value="">Tất cả sân</option>
          {courts.map((court) => (
            <option key={court.id} value={court.id}>
              {court.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Khung giờ</span>
        <select value={value.timeRange} onChange={(event) => onChange({ ...value, timeRange: event.target.value as ManagerScheduleFilterState["timeRange"] })}>
          <option value="ALL">Cả ngày</option>
          <option value="MORNING">Buổi sáng</option>
          <option value="AFTERNOON">Buổi chiều</option>
          <option value="EVENING">Buổi tối</option>
        </select>
      </label>
    </div>
  );
}
