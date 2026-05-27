import { useMemo, useState } from "react";
import { CalendarDays, Clock, CreditCard, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../components/common/Button";
import { CourtGrid } from "../../components/courts/CourtGrid";
import { CourtFilterDrawer } from "../../components/filters/CourtFilterDrawer";
import { SearchFilterBar } from "../../components/layout/SearchFilterBar";
import { mockCourts } from "../../features/courts/data/mockCourts";
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
  const user = useAuthStore((state) => state.user);
  const [courts, setCourts] = useState(mockCourts.slice(0, 4));
  const [filters, setFilters] = useState<CourtFilterState>(defaultCourtFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const filteredCourts = useMemo(() => {
    return filterCourts(courts, searchKeyword, filters);
  }, [courts, filters, searchKeyword]);

  const handleToggleFavorite = (courtId: string) => {
    setCourts((currentCourts) =>
      currentCourts.map((court) => (court.id === courtId ? { ...court, isFavorite: !court.isFavorite } : court))
    );
  };

  const handleBook = (courtId: string) => {
    const court = courts.find((item) => item.id === courtId);

    addToast({
      type: "info",
      title: "Preview UI",
      message: `Luồng đặt lịch cho ${court?.name ?? "sân này"} sẽ được triển khai ở module booking.`
    });
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
          Xin chào {user?.fullName ?? "bạn"}. Đây là preview design system với mock data để kiểm tra search, filter, court card và responsive grid.
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
        resultCount={filteredCourts.length}
        value={searchKeyword}
        onOpenFilter={() => setIsFilterOpen(true)}
        onOpenMap={() => addToast({ type: "info", title: "Bản đồ", message: "Map view sẽ được triển khai ở module sau." })}
        onSearchChange={setSearchKeyword}
        onShowBooked={() => addToast({ type: "info", title: "Sân đã đặt", message: "Danh sách sân đã đặt sẽ dùng dữ liệu booking sau." })}
        onShowFavorites={() => setFilters((currentFilters) => ({ ...currentFilters, favoritesOnly: !currentFilters.favoritesOnly }))}
      />

      <div className="section-heading">
        <div>
          <p className="eyebrow">Sân nổi bật</p>
          <h2>Preview component CourtCard</h2>
        </div>
        <Button variant="secondary" onClick={() => setSearchKeyword("")}>
          Làm mới tìm kiếm
        </Button>
      </div>

      <CourtGrid
        courts={filteredCourts}
        getCourtDetailPath={buildCourtDetailPath}
        onBook={handleBook}
        onShare={handleShare}
        onToggleFavorite={handleToggleFavorite}
      />

      <div className="home-court-link">
        <Link className="ui-button ui-button--primary ui-button--lg" to={ROUTE_PATHS.courts}>
          Xem tất cả sân
        </Link>
      </div>

      <CourtFilterDrawer
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
