import { useMemo, useState } from "react";
import { CalendarDays, Clock, CreditCard, ShieldCheck } from "lucide-react";

import { Button } from "../../components/common/Button";
import { CourtGrid } from "../../components/courts/CourtGrid";
import { CourtFilterDrawer } from "../../components/filters/CourtFilterDrawer";
import { SearchFilterBar } from "../../components/layout/SearchFilterBar";
import { useAuthStore } from "../../stores/auth.store";
import { useToastStore } from "../../stores/toast.store";
import type { CourtCardViewModel, CourtFilterState } from "../../types/court.types";

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

const defaultFilters: CourtFilterState = {
  courtTypes: [],
  statuses: [],
  priceRange: [0, 500000],
  timeSlot: "",
  favoritesOnly: false
};

const mockCourts: CourtCardViewModel[] = [
  {
    id: "court-football-01",
    name: "Sân bóng đá trung tâm",
    rating: 4.8,
    distanceText: "350m",
    address: "Khu thể thao A, cổng chính",
    openTime: "06:00",
    closeTime: "22:00",
    status: "ACTIVE",
    tags: ["Bóng đá", "Ngoài trời", "Sân 7"],
    hasPromotion: true,
    isFavorite: true
  },
  {
    id: "court-badminton-02",
    name: "Nhà thi đấu cầu lông",
    rating: 4.6,
    distanceText: "500m",
    address: "Nhà thi đấu B, tầng 1",
    openTime: "07:00",
    closeTime: "21:00",
    status: "MAINTENANCE",
    tags: ["Cầu lông", "Trong nhà", "Sàn gỗ"],
    isFavorite: false
  },
  {
    id: "court-tennis-03",
    name: "Sân tennis khu giảng viên",
    rating: 4.7,
    distanceText: "1.2km",
    address: "Khu thể thao C, cạnh thư viện",
    openTime: "05:30",
    closeTime: "20:30",
    status: "TEMP_CLOSED",
    tags: ["Tennis", "Ngoài trời", "Ưu tiên"],
    isFavorite: false
  },
  {
    id: "court-basketball-04",
    name: "Sân bóng rổ cũ",
    rating: 4.1,
    distanceText: "900m",
    address: "Khu ký túc xá cũ",
    openTime: "06:00",
    closeTime: "18:00",
    status: "RETIRED",
    tags: ["Bóng rổ", "Ngoài trời"],
    isFavorite: false
  }
];

export function HomePage() {
  const { addToast } = useToastStore();
  const user = useAuthStore((state) => state.user);
  const [courts, setCourts] = useState(mockCourts);
  const [filters, setFilters] = useState<CourtFilterState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  const filteredCourts = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return courts.filter((court) => {
      const matchesKeyword =
        !normalizedKeyword ||
        court.name.toLowerCase().includes(normalizedKeyword) ||
        court.tags.some((tag) => tag.toLowerCase().includes(normalizedKeyword));
      const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(court.status);
      const matchesType = filters.courtTypes.length === 0 || court.tags.some((tag) => filters.courtTypes.includes(tag));
      const matchesFavorite = !filters.favoritesOnly || court.isFavorite;

      return matchesKeyword && matchesStatus && matchesType && matchesFavorite;
    });
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

      <CourtGrid courts={filteredCourts} onBook={handleBook} onShare={handleShare} onToggleFavorite={handleToggleFavorite} />

      <CourtFilterDrawer
        filters={filters}
        isOpen={isFilterOpen}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setIsFilterOpen(false);
        }}
        onChange={setFilters}
        onClear={() => setFilters(defaultFilters)}
        onClose={() => setIsFilterOpen(false)}
      />
    </section>
  );
}
