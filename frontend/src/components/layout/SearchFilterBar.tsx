import { CalendarCheck, Filter, Heart, Map, Search } from "lucide-react";

import { Button } from "../common/Button";

type SearchFilterBarProps = {
  value: string;
  resultCount?: number;
  resultUnit?: string;
  placeholder?: string;
  onSearchChange: (value: string) => void;
  onOpenFilter?: () => void;
  onOpenMap?: () => void;
  onShowBooked?: () => void;
  onShowFavorites?: () => void;
};

export function SearchFilterBar({
  placeholder = "Tìm kiếm sân...",
  resultCount,
  resultUnit = "sân",
  onOpenFilter,
  onOpenMap,
  onSearchChange,
  onShowBooked,
  onShowFavorites,
  value
}: SearchFilterBarProps) {
  const hasActions = Boolean(onOpenFilter || onOpenMap || onShowBooked || onShowFavorites);

  return (
    <section className="search-filter-bar" aria-label="Tìm kiếm và lọc sân">
      <label className="search-input">
        <Search aria-hidden="true" size={20} />
        <span className="sr-only">Tìm kiếm sân</span>
        <input placeholder={placeholder} type="search" value={value} onChange={(event) => onSearchChange(event.target.value)} />
      </label>

      {typeof resultCount === "number" ? <span className="result-count">{resultCount} {resultUnit}</span> : null}

      {hasActions ? (
        <div className="search-actions">
          {onOpenFilter ? (
            <Button className="search-action-button" size="sm" variant="secondary" onClick={onOpenFilter}>
              <Filter aria-hidden="true" size={16} />
              Bộ lọc
            </Button>
          ) : null}
          {onOpenMap ? (
            <Button className="search-action-button" size="sm" variant="ghost" onClick={onOpenMap}>
              <Map aria-hidden="true" size={16} />
              Bản đồ
            </Button>
          ) : null}
          {onShowBooked ? (
            <Button className="search-action-button" size="sm" variant="ghost" onClick={onShowBooked}>
              <CalendarCheck aria-hidden="true" size={16} />
              Sân đã đặt
            </Button>
          ) : null}
          {onShowFavorites ? (
            <Button className="search-action-button" size="sm" variant="ghost" onClick={onShowFavorites}>
              <Heart aria-hidden="true" size={16} />
              Yêu thích
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
