import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { CourtGrid } from "../../../components/courts/CourtGrid";
import { CourtFilterDrawer } from "../../../components/filters/CourtFilterDrawer";
import { SearchFilterBar } from "../../../components/layout/SearchFilterBar";
import { buildCourtDetailPath } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import type { CourtFilterState } from "../../../types/court.types";
import { listCourts } from "../services/courtService";
import type { CourtDetailViewModel, CourtSortOption } from "../types/court-detail.types";
import { defaultCourtFilters, filterCourts, sortCourts } from "../utils/courtFilters";

const sortOptions: Array<{ value: CourtSortOption; label: string }> = [
  { value: "available_first", label: "Khả dụng trước" },
  { value: "name_asc", label: "Tên A-Z" }
];

export function CourtListPage() {
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [courts, setCourts] = useState<CourtDetailViewModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CourtFilterState>(defaultCourtFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortBy, setSortBy] = useState<CourtSortOption>("available_first");

  const loadCourts = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const loadedCourts = await listCourts();
      setCourts(loadedCourts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const areaOptions = useMemo(() => {
    return Array.from(
      new Set(courts.map((court) => court.area).filter((area): area is string => Boolean(area)))
    ).sort((first, second) => first.localeCompare(second, "vi"));
  }, [courts]);

  useEffect(() => {
    void loadCourts();
  }, []);

  const visibleCourts = useMemo(() => {
    return sortCourts(filterCourts(courts, searchKeyword, filters), sortBy);
  }, [courts, filters, searchKeyword, sortBy]);
  const courtTypeOptions = useMemo(() => {
    return Array.from(new Set(courts.map((court) => court.courtType))).sort((first, second) => first.localeCompare(second, "vi"));
  }, [courts]);

  const handleToggleFavorite = (courtId: string) => {
    setCourts((currentCourts) =>
      currentCourts.map((court) => (court.id === courtId ? { ...court, isFavorite: !court.isFavorite } : court))
    );
  };

  const handleBook = (courtId: string) => {
    navigate(buildCourtDetailPath(courtId));
  };

  const handleShare = (courtId: string) => {
    const court = courts.find((item) => item.id === courtId);

    addToast({
      type: "info",
      title: "Chia sẻ sân",
      message: court ? `Đã chọn chia sẻ ${court.name}.` : "Đã chọn chia sẻ sân."
    });
  };

  if (isLoading) {
    return <LoadingState message="Đang tải danh sách sân..." title="Danh sách sân" />;
  }

  if (error) {
    return <ErrorState actionLabel="Thử lại" message={error} title="Không tải được danh sách sân" onAction={loadCourts} />;
  }

  return (
    <section className="page-stack">
      <div className="listing-header">
        <div>
          <p className="eyebrow">Khám phá sân</p>
          <h1>Danh sách sân thể thao</h1>
          <p>Tìm sân theo loại hình, trạng thái, khung giờ và giá bằng dữ liệu vận hành từ database.</p>
        </div>
        <Button variant="secondary" onClick={() => setIsFilterOpen(true)}>
          <SlidersHorizontal aria-hidden="true" size={18} />
          Lọc nâng cao
        </Button>
      </div>

      <SearchFilterBar
        resultCount={visibleCourts.length}
        value={searchKeyword}
        onOpenFilter={() => setIsFilterOpen(true)}
        onOpenMap={() => addToast({ type: "info", title: "Bản đồ", message: "Map view sẽ được triển khai ở module sau." })}
        onSearchChange={setSearchKeyword}
        onShowBooked={() => addToast({ type: "info", title: "Sân đã đặt", message: "Danh sách sân đã đặt sẽ dùng dữ liệu booking." })}
        onShowFavorites={() => setFilters((currentFilters) => ({ ...currentFilters, favoritesOnly: !currentFilters.favoritesOnly }))}
      />

      <div className="list-toolbar">
        <div className="list-toolbar__summary">
          <ArrowDownAZ aria-hidden="true" size={18} />
          <span>{visibleCourts.length} kết quả</span>
        </div>
        <label className="sort-control">
          <span>Sắp xếp</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as CourtSortOption)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CourtGrid
        courts={visibleCourts}
        getCourtDetailPath={buildCourtDetailPath}
        onBook={handleBook}
        onShare={handleShare}
        onToggleFavorite={handleToggleFavorite}
      />

      <CourtFilterDrawer
        areas={areaOptions}
        courtTypes={courtTypeOptions}
        filters={filters}
        isOpen={isFilterOpen}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setIsFilterOpen(false);
        }}
        onChange={setFilters}
        onClear={() => setFilters(defaultCourtFilters)}
        onClose={() => setIsFilterOpen(false)}
      />
    </section>
  );
}
