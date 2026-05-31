import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, CreditCard, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/common/Button";
import { EmptyState } from "../../components/common/EmptyState";
import { CourtGrid } from "../../components/courts/CourtGrid";
import { CourtFilterDrawer } from "../../components/filters/CourtFilterDrawer";
import { SearchFilterBar } from "../../components/layout/SearchFilterBar";
import { buildCourtTypeSummaries, CourtTypeSelection, filterCourtTypes } from "../../features/courts/components/CourtTypeSelection";
import { listCourts } from "../../features/courts/services/courtService";
import type { CourtDetailViewModel } from "../../features/courts/types/court-detail.types";
import { defaultCourtFilters, filterCourts } from "../../features/courts/utils/courtFilters";
import { buildCourtDetailPath, ROUTE_PATHS } from "../../routes/route-paths";
import { useAuthStore } from "../../stores/auth.store";
import { useToastStore } from "../../stores/toast.store";
import type { CourtFilterState } from "../../types/court.types";

const summaryItems = [
  {
    icon: CalendarDays,
    label: "Giữ chỗ",
    value: "PENDING_PAYMENT"
  },
  {
    icon: CreditCard,
    label: "Thanh toán",
    value: "100%"
  },
  {
    icon: ShieldCheck,
    label: "Xác nhận",
    value: "Payment success"
  },
  {
    icon: Clock,
    label: "Check-in",
    value: "Manager/Admin"
  }
] as const;

export function HomePage() {
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [courts, setCourts] = useState<CourtDetailViewModel[]>([]);
  const [courtLoadError, setCourtLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CourtFilterState>(defaultCourtFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadingCourts, setIsLoadingCourts] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCourtType, setSelectedCourtType] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFeaturedCourts() {
      setIsLoadingCourts(true);
      setCourtLoadError(null);

      try {
        const loadedCourts = await listCourts();

        if (isMounted) {
          setCourts(loadedCourts);
        }
      } catch (error) {
        if (isMounted) {
          setCourtLoadError(error instanceof Error ? error.message : "Không tải được dữ liệu sân.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingCourts(false);
        }
      }
    }

    void loadFeaturedCourts();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCourts = useMemo(() => {
    const scopedFilters = selectedCourtType ? { ...filters, courtTypes: [selectedCourtType] } : filters;
    return filterCourts(courts, searchKeyword, scopedFilters);
  }, [courts, filters, searchKeyword, selectedCourtType]);
  const courtTypeSummaries = useMemo(() => buildCourtTypeSummaries(courts), [courts]);
  const visibleCourtTypes = useMemo(() => filterCourtTypes(courtTypeSummaries, searchKeyword), [courtTypeSummaries, searchKeyword]);
  const courtTypeOptions = useMemo(() => {
    return selectedCourtType ? [selectedCourtType] : courtTypeSummaries.map((courtType) => courtType.typeName);
  }, [courtTypeSummaries, selectedCourtType]);
  const areaOptions = useMemo(() => {
    return Array.from(
      new Set(courts.map((court) => court.area).filter((area): area is string => Boolean(area)))
    ).sort((first, second) => first.localeCompare(second, "vi"));
  }, [courts]);

  const handleToggleFavorite = (courtId: string) => {
    setCourts((currentCourts) =>
      currentCourts.map((court) => (court.id === courtId ? { ...court, isFavorite: !court.isFavorite } : court))
    );
  };

  const handleBook = (courtId: string) => {
    navigate(buildCourtDetailPath(courtId));
  };

  const handleSelectCourtType = (courtType: string) => {
    setSelectedCourtType(courtType);
    setSearchKeyword("");
    setFilters(defaultCourtFilters);
  };

  const handleBackToCourtTypes = () => {
    setSelectedCourtType(null);
    setSearchKeyword("");
    setFilters(defaultCourtFilters);
  };

  const handleShare = (courtId: string) => {
    const court = courts.find((item) => item.id === courtId);

    addToast({
      type: "info",
      title: "Chia sẻ sân",
      message: court ? `Đã chọn chia sẻ ${court.name}.` : "Đã chọn chia sẻ sân."
    });
  };

  return (
    <section className="page-stack">
      <div className="page-hero">
        <p className="eyebrow">CourtSphere marketplace</p>
        <h1>Sân thể thao sẵn sàng cho lịch học và hoạt động đội nhóm</h1>
        <p>
          Xin chào {user?.fullName ?? "bạn"}. Danh sách sân, trạng thái và giá đang được tải từ dữ liệu vận hành trong database.
        </p>
      </div>

      <div className="summary-grid">
        {summaryItems.map((item) => {
          const Icon = item.icon;

          return (
            <article className="summary-card" key={item.label}>
              <Icon aria-hidden="true" size={22} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          );
        })}
      </div>

      <SearchFilterBar
        placeholder={selectedCourtType ? `Tìm sân ${selectedCourtType}...` : "Tìm loại sân..."}
        resultCount={selectedCourtType ? filteredCourts.length : visibleCourtTypes.length}
        resultUnit={selectedCourtType ? "sân" : "loại sân"}
        value={searchKeyword}
        onOpenFilter={selectedCourtType ? () => setIsFilterOpen(true) : undefined}
        onOpenMap={selectedCourtType ? () => addToast({ type: "info", title: "Bản đồ", message: "Map view sẽ được triển khai ở module sau." }) : undefined}
        onSearchChange={setSearchKeyword}
        onShowBooked={selectedCourtType ? () => addToast({ type: "info", title: "Sân đã đặt", message: "Danh sách sân đã đặt sẽ dùng dữ liệu booking." }) : undefined}
        onShowFavorites={selectedCourtType ? () => setFilters((currentFilters) => ({ ...currentFilters, favoritesOnly: !currentFilters.favoritesOnly })) : undefined}
      />

      <div className="section-heading">
        <div>
          <p className="eyebrow">{selectedCourtType ? "Chọn sân" : "Chọn loại sân"}</p>
          <h2>{selectedCourtType ? `Sân ${selectedCourtType}` : "Bạn muốn đặt loại sân nào?"}</h2>
        </div>
        {selectedCourtType ? (
          <Button variant="secondary" onClick={handleBackToCourtTypes}>
            Chọn loại sân khác
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setSearchKeyword("")}>
            Làm mới tìm kiếm
          </Button>
        )}
      </div>

      {isLoadingCourts ? <p role="status">Đang tải dữ liệu sân...</p> : null}
      {courtLoadError ? <p role="alert">{courtLoadError}</p> : null}
      {!isLoadingCourts && !courtLoadError && selectedCourtType ? (
        <CourtGrid
          courts={filteredCourts}
          getCourtDetailPath={buildCourtDetailPath}
          onBook={handleBook}
          onShare={handleShare}
          onToggleFavorite={handleToggleFavorite}
        />
      ) : null}
      {!isLoadingCourts && !courtLoadError && !selectedCourtType && visibleCourtTypes.length ? (
        <CourtTypeSelection courtTypes={visibleCourtTypes} onSelect={handleSelectCourtType} />
      ) : null}
      {!isLoadingCourts && !courtLoadError && !selectedCourtType && !visibleCourtTypes.length ? (
        <EmptyState title="Chưa có loại sân phù hợp" message="Không tìm thấy loại sân theo từ khóa hiện tại." />
      ) : null}

      <div className="home-court-link">
        <Link className="ui-button ui-button--primary ui-button--lg" to={ROUTE_PATHS.courts}>
          Xem tất cả sân
        </Link>
      </div>

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
