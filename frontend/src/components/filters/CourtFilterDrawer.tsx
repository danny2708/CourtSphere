import { X } from "lucide-react";

import { Button } from "../common/Button";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { courtStatusLabel } from "../../utils/status-label";
import type { CourtFilterState, CourtStatus } from "../../types/court.types";

type CourtFilterDrawerProps = {
  filters: CourtFilterState;
  isOpen: boolean;
  courtTypes: string[];
  areas?: string[];
  onApply: (filters: CourtFilterState) => void;
  onChange: (filters: CourtFilterState) => void;
  onClear: () => void;
  onClose: () => void;
};

const courtStatuses: CourtStatus[] = ["ACTIVE", "MAINTENANCE", "TEMP_CLOSED", "RETIRED"];
const timeSlots = ["Sáng", "Chiều", "Tối"];

export function CourtFilterDrawer({
  areas = [],
  courtTypes,
  filters,
  isOpen,
  onApply,
  onChange,
  onClear,
  onClose
}: CourtFilterDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="filter-drawer-title">
      <button className="filter-drawer__backdrop" type="button" aria-label="Đóng bộ lọc" onClick={onClose} />

      <aside className="filter-drawer__panel">
        <div className="filter-drawer__header">
          <div>
            <p className="eyebrow">Bộ lọc</p>
            <h2 id="filter-drawer-title">Lọc sân</h2>
          </div>
          <Button aria-label="Đóng bộ lọc" size="sm" variant="icon" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </Button>
        </div>

        <SearchableMultiSelect
          label="Loại sân"
          options={courtTypes.map((type) => ({ value: type, label: type }))}
          values={filters.courtTypes}
          onChange={(courtTypes) => onChange({ ...filters, courtTypes })}
        />

        <SearchableMultiSelect<CourtStatus>
          label="Trạng thái sân"
          options={courtStatuses.map((status) => ({
            value: status,
            label: courtStatusLabel[status]
          }))}
          values={filters.statuses}
          onChange={(statuses) => onChange({ ...filters, statuses })}
        />

        <SearchableMultiSelect
          label="Khu vực"
          options={areas.map((area) => ({ value: area, label: area }))}
          values={filters.areas}
          onChange={(areas) => onChange({ ...filters, areas })}
        />

        <div className="filter-section">
          <h3>Khoảng giá</h3>
          <div className="price-range">
            <label>
              Từ
              <input
                min="0"
                step="50000"
                type="number"
                value={filters.priceRange[0]}
                onChange={(event) => onChange({ ...filters, priceRange: [Number(event.target.value), filters.priceRange[1]] })}
              />
            </label>
            <label>
              Đến
              <input
                min="0"
                step="50000"
                type="number"
                value={filters.priceRange[1]}
                onChange={(event) => onChange({ ...filters, priceRange: [filters.priceRange[0], Number(event.target.value)] })}
              />
            </label>
          </div>
        </div>

        <SearchableMultiSelect
          label="Khung giờ"
          options={timeSlots.map((slot) => ({ value: slot, label: slot }))}
          values={filters.timeSlots}
          onChange={(timeSlots) => onChange({ ...filters, timeSlots })}
        />

        <label className="filter-toggle">
          <input
            checked={filters.favoritesOnly}
            type="checkbox"
            onChange={(event) => onChange({ ...filters, favoritesOnly: event.target.checked })}
          />
          <span>Chỉ hiển thị sân yêu thích</span>
        </label>

        <div className="filter-drawer__footer">
          <Button variant="secondary" onClick={onClear}>
            Xóa lọc
          </Button>
          <Button onClick={() => onApply(filters)}>Áp dụng</Button>
        </div>
      </aside>
    </div>
  );
}
