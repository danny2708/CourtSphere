import { CalendarCheck, Filter, Heart, Map, Search } from "lucide-react";

import { Button } from "../common/Button";

type SearchFilterBarProps = {
  value: string;
  resultCount?: number;
  onSearchChange: (value: string) => void;
  onOpenFilter?: () => void;
  onOpenMap?: () => void;
  onShowBooked?: () => void;
  onShowFavorites?: () => void;
};

export function SearchFilterBar({
  resultCount,
  onOpenFilter,
  onOpenMap,
  onSearchChange,
  onShowBooked,
  onShowFavorites,
  value
}: SearchFilterBarProps) {
  return (
    <section className="search-filter-bar" aria-label="Tìm kiếm và lọc sân">
      <label className="search-input">
        <Search aria-hidden="true" size={20} />
        <span className="sr-only">Tìm kiếm sân</span>
        <input placeholder="Tìm kiếm sân..." type="search" value={value} onChange={(event) => onSearchChange(event.target.value)} />
      </label>

      {typeof resultCount === "number" ? <span className="result-count">{resultCount} sân</span> : null}

      <div className="search-actions">
        <Button className="search-action-button" size="sm" variant="secondary" onClick={onOpenFilter}>
          <Filter aria-hidden="true" size={16} />
          Bộ lọc
        </Button>
        <Button className="search-action-button" size="sm" variant="ghost" onClick={onOpenMap}>
          <Map aria-hidden="true" size={16} />
          Bản đồ
        </Button>
        <Button className="search-action-button" size="sm" variant="ghost" onClick={onShowBooked}>
          <CalendarCheck aria-hidden="true" size={16} />
          Sân đã đặt
        </Button>
        <Button className="search-action-button" size="sm" variant="ghost" onClick={onShowFavorites}>
          <Heart aria-hidden="true" size={16} />
          Yêu thích
        </Button>
      </div>
    </section>
  );
}
