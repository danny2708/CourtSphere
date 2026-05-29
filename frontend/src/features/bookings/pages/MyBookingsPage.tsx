import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { Button } from "../../../components/common/Button";
import { getErrorMessage } from "../../../utils/format-error";
import { MyBookingCard } from "../components/MyBookingCard";
import { listMyBookings } from "../services/bookingService";
import type { BookingOrder } from "../types/booking.types";

type BookingTab = "ALL" | "PENDING_PAYMENT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

const tabs: Array<{ label: string; value: BookingTab }> = [
  { label: "Tất cả", value: "ALL" },
  { label: "Chờ thanh toán", value: "PENDING_PAYMENT" },
  { label: "Đã xác nhận", value: "CONFIRMED" },
  { label: "Hoàn thành", value: "COMPLETED" },
  { label: "Đã hủy/hết hạn", value: "CANCELLED" }
];

function matchesTab(booking: BookingOrder, tab: BookingTab): boolean {
  if (tab === "ALL") {
    return true;
  }

  if (tab === "CANCELLED") {
    return booking.bookingStatus.includes("CANCELLED") || booking.bookingStatus === "PAYMENT_EXPIRED";
  }

  return booking.bookingStatus === tab;
}

export function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState<BookingTab>("ALL");
  const [bookings, setBookings] = useState<BookingOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBookings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setBookings(await listMyBookings());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBookings();
  }, []);

  const filteredBookings = useMemo(
    () => bookings.filter((booking) => matchesTab(booking, activeTab)),
    [activeTab, bookings]
  );

  if (isLoading) {
    return <LoadingState title="Đơn của tôi" message="Đang tải danh sách đặt sân..." />;
  }

  if (error) {
    return <ErrorState title="Không tải được đơn đặt sân" message={error} actionLabel="Thử lại" onAction={loadBookings} />;
  }

  return (
    <section className="page-stack">
      <div className="listing-header">
        <div>
          <p className="eyebrow">CourtSphere</p>
          <h1>Đơn đặt sân của tôi</h1>
          <p>Theo dõi trạng thái giữ chỗ, thanh toán, xác nhận, hủy và hoàn tiền.</p>
        </div>
      </div>

      <div className="booking-tabs" role="tablist" aria-label="Lọc đơn đặt sân">
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            variant={activeTab === tab.value ? "primary" : "secondary"}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {filteredBookings.length === 0 ? (
        <EmptyState
          title="Chưa có đơn phù hợp"
          message="Bạn chưa có đơn đặt sân ở nhóm trạng thái này."
        />
      ) : (
        <div className="my-booking-grid">
          {filteredBookings.map((booking) => (
            <MyBookingCard key={booking.bookingOrderId} booking={booking} />
          ))}
        </div>
      )}
    </section>
  );
}
