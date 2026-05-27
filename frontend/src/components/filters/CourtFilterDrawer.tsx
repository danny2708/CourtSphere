import { X } from "lucide-react";

import { Button } from "../common/Button";
import { courtStatusLabel } from "../../utils/status-label";
import type { CourtFilterState, CourtStatus } from "../../types/court.types";

type CourtFilterDrawerProps = {
  filters: CourtFilterState;
  isOpen: boolean;
  onApply: (filters: CourtFilterState) => void;
  onChange: (filters: CourtFilterState) => void;
  onClear: () => void;
  onClose: () => void;
};

const courtTypes = ["Bóng đá", "Cầu lông", "Tennis", "Bóng rổ", "Đa năng", "Trong nhà", "Ngoài trời"];
const courtStatuses: CourtStatus[] = ["ACTIVE", "MAINTENANCE", "TEMP_CLOSED", "RETIRED"];
const timeSlots = ["Sáng", "Chiều", "Tối"];

function toggleString(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function toggleStatus(values: CourtStatus[], value: CourtStatus): CourtStatus[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function CourtFilterDrawer({ filters, isOpen, onApply, onChange, onClear, onClose }: CourtFilterDrawerProps) {
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

        <div className="filter-section">
          <h3>Loại sân</h3>
          <div className="filter-chip-grid">
            {courtTypes.map((type) => (
              <label key={type} className="filter-chip">
                <input
                  checked={filters.courtTypes.includes(type)}
                  type="checkbox"
                  onChange={() => onChange({ ...filters, courtTypes: toggleString(filters.courtTypes, type) })}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h3>Trạng thái sân</h3>
          <div className="filter-chip-grid">
            {courtStatuses.map((status) => (
              <label key={status} className="filter-chip">
                <input
                  checked={filters.statuses.includes(status)}
                  type="checkbox"
                  onChange={() => onChange({ ...filters, statuses: toggleStatus(filters.statuses, status) })}
                />
                <span>{courtStatusLabel[status]}</span>
              </label>
            ))}
          </div>
        </div>

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

        <div className="filter-section">
          <h3>Khung giờ</h3>
          <div className="filter-chip-grid">
            {timeSlots.map((slot) => (
              <label key={slot} className="filter-chip">
                <input
                  checked={filters.timeSlot === slot}
                  name="timeSlot"
                  type="radio"
                  onChange={() => onChange({ ...filters, timeSlot: slot })}
                />
                <span>{slot}</span>
              </label>
            ))}
          </div>
        </div>

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
