import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/common/Button";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { getErrorMessage } from "../../../utils/format-error";
import { cancelWaitlist, listMyWaitlist, type WaitlistEntry } from "../../courts/services/waitlistService";
import { MyBookingCard } from "../components/MyBookingCard";
import { MyWaitlistCard } from "../components/MyWaitlistCard";
import { listMyBookings } from "../services/bookingService";
import type { BookingOrder } from "../types/booking.types";

type BookingTab = "ALL" | "PENDING_PAYMENT" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "WAITLIST";

const tabs: Array<{ label: string; value: BookingTab }> = [
  { label: "Tất cả", value: "ALL" },
  { label: "Chờ thanh toán", value: "PENDING_PAYMENT" },
  { label: "Đã xác nhận", value: "CONFIRMED" },
  { label: "Hoàn thành", value: "COMPLETED" },
  { label: "Đã hủy/hết hạn", value: "CANCELLED" },
  { label: "Hàng chờ", value: "WAITLIST" }
];

function matchesBookingTab(booking: BookingOrder, tab: BookingTab): boolean {
  if (tab === "ALL") {
    return true;
  }

  if (tab === "WAITLIST") {
    return false;
  }

  if (tab === "CANCELLED") {
    return booking.bookingStatus.includes("CANCELLED") || booking.bookingStatus === "PAYMENT_EXPIRED";
  }

  return booking.bookingStatus === tab;
}

function matchesWaitlistTab(entry: WaitlistEntry, tab: BookingTab): boolean {
  if (entry.status === "BOOKED") {
    return false;
  }

  if (tab === "ALL" || tab === "WAITLIST") {
    return true;
  }

  return false;
}

export function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState<BookingTab>("ALL");
  const [bookings, setBookings] = useState<BookingOrder[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [cancellingWaitlistId, setCancellingWaitlistId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPageData = async () => {
    setIsLoading(true);
    setError(null);
    setWaitlistError(null);

    try {
      const [nextBookings, nextWaitlistEntries] = await Promise.all([listMyBookings(), listMyWaitlist()]);
      setBookings(nextBookings);
      setWaitlistEntries(nextWaitlistEntries);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, []);

  const filteredBookings = useMemo(
    () => bookings.filter((booking) => matchesBookingTab(booking, activeTab)),
    [activeTab, bookings]
  );

  const filteredWaitlistEntries = useMemo(
    () => waitlistEntries.filter((entry) => matchesWaitlistTab(entry, activeTab)),
    [activeTab, waitlistEntries]
  );

  const isEmptyTab = filteredBookings.length === 0 && filteredWaitlistEntries.length === 0;

  const handleCancelWaitlist = async (entry: WaitlistEntry) => {
    const confirmed = window.confirm(
      `Bạn chắc chắn muốn hủy hàng chờ sân ${entry.court.courtName} cho khung giờ đã chọn?`
    );

    if (!confirmed) {
      return;
    }

    setCancellingWaitlistId(entry.waitlistEntryId);
    setWaitlistError(null);

    try {
      const updatedEntry = await cancelWaitlist(entry.waitlistEntryId);
      setWaitlistEntries((currentEntries) =>
        currentEntries.map((currentEntry) =>
          currentEntry.waitlistEntryId === updatedEntry.waitlistEntryId ? updatedEntry : currentEntry
        )
      );
    } catch (cancelError) {
      setWaitlistError(getErrorMessage(cancelError));
    } finally {
      setCancellingWaitlistId(null);
    }
  };

  if (isLoading) {
    return <LoadingState title="Đơn của tôi" message="Đang tải danh sách đặt sân..." />;
  }

  if (error) {
    return <ErrorState title="Không tải được đơn đặt sân" message={error} actionLabel="Thử lại" onAction={loadPageData} />;
  }

  return (
    <section className="page-stack">
      <div className="listing-header">
        <div>
          <p className="eyebrow">CourtSphere</p>
          <h1>Đơn đặt sân của tôi</h1>
          <p>Theo dõi trạng thái giữ chỗ, thanh toán, xác nhận, hủy, hàng chờ và hoàn tiền.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadPageData}>
          Tải lại
        </Button>
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

      {waitlistError ? <p className="form-alert">{waitlistError}</p> : null}

      {isEmptyTab ? (
        <EmptyState
          title="Chưa có mục phù hợp"
          message={
            activeTab === "WAITLIST"
              ? "Bạn chưa có lượt hàng chờ nào."
              : "Bạn chưa có đơn đặt sân hoặc hàng chờ ở nhóm trạng thái này."
          }
        />
      ) : (
        <div className="my-booking-grid">
          {filteredWaitlistEntries.map((entry) => (
            <MyWaitlistCard
              key={entry.waitlistEntryId}
              entry={entry}
              isCancelling={cancellingWaitlistId === entry.waitlistEntryId}
              onCancel={handleCancelWaitlist}
            />
          ))}
          {filteredBookings.map((booking) => (
            <MyBookingCard key={booking.bookingOrderId} booking={booking} />
          ))}
        </div>
      )}
    </section>
  );
}
