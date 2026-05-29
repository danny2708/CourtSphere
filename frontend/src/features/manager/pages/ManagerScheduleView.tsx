import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "../../../components/common/Button";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { ManagerActionDialog } from "../components/ManagerActionDialog";
import { ManagerBookingItemCard } from "../components/ManagerBookingItemCard";
import { ManagerNavigation } from "../components/ManagerNavigation";
import { ManagerScheduleFilters } from "../components/ManagerScheduleFilters";
import { ManagerStatusTabs, type ManagerStatusTabValue } from "../components/ManagerStatusTabs";
import {
  checkInBookingItem,
  getManagerTodaySchedule,
  listManagerCourts,
  managerCancelBooking,
  markNoShow,
  overrideComplete,
  overrideLateCheckIn
} from "../services/managerService";
import type {
  ManagerBookingItemStatus,
  ManagerBookingItemViewModel,
  ManagerCourtViewModel,
  ManagerScheduleFilterState
} from "../types/manager.types";

type ManagerActionMode = "CHECK_IN" | "OVERRIDE_CHECK_IN" | "NO_SHOW" | "OVERRIDE_COMPLETE" | "CANCEL_BOOKING";

type ActiveAction = {
  item: ManagerBookingItemViewModel;
  mode: ManagerActionMode;
};

type ManagerScheduleViewProps = {
  title: string;
  description: string;
  fixedStatus?: ManagerBookingItemStatus;
  emptyTitle: string;
  emptyDescription: string;
};

const initialFilters: ManagerScheduleFilterState = {
  courtId: "",
  keyword: "",
  status: "ALL",
  timeRange: "ALL"
};

function matchesKeyword(item: ManagerBookingItemViewModel, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return [item.bookingCode, item.userName, item.userEmail, item.courtName, item.courtTypeName]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedKeyword));
}

function matchesTimeRange(item: ManagerBookingItemViewModel, timeRange: ManagerScheduleFilterState["timeRange"]): boolean {
  if (timeRange === "ALL") {
    return true;
  }

  const hour = new Date(item.startDatetime).getHours();
  if (timeRange === "MORNING") {
    return hour < 12;
  }
  if (timeRange === "AFTERNOON") {
    return hour >= 12 && hour < 18;
  }
  return hour >= 18;
}

function getDialogConfig(action: ActiveAction) {
  if (action.mode === "CHECK_IN") {
    return {
      confirmLabel: "Xác nhận check-in",
      description: `Xác nhận người đặt ${action.item.userName ?? ""} đã đến sân ${action.item.courtName ?? ""}.`,
      isReasonRequired: false,
      title: "Check-in booking"
    };
  }

  if (action.mode === "OVERRIDE_CHECK_IN") {
    return {
      confirmLabel: "Cho check-in muộn",
      description: "Chỉ dùng override khi booking đã quá giờ check-in nhưng sân vẫn có thể sử dụng.",
      isReasonRequired: true,
      title: "Override check-in muộn",
      warning: "Thao tác này sẽ chuyển booking item sang Đang sử dụng và ghi audit log."
    };
  }

  if (action.mode === "NO_SHOW") {
    return {
      confirmLabel: "Xác nhận no-show",
      description: "Xác nhận người đặt không đến sân sau khi đã quá giờ check-in.",
      isReasonRequired: false,
      title: "Xác nhận no-show",
      warning: "No-show không tạo refund và có thể ghi nhận vi phạm cho người dùng."
    };
  }

  if (action.mode === "OVERRIDE_COMPLETE") {
    return {
      confirmLabel: "Override complete",
      description: "Chỉ hoàn thành thủ công trong trường hợp ngoại lệ hoặc cần đóng sớm.",
      isReasonRequired: true,
      title: "Hoàn thành ngoại lệ",
      warning: "Luồng mặc định là hệ thống tự complete khi hết giờ."
    };
  }

  return {
    confirmLabel: "Hủy booking",
    description: "Hủy booking do sân lỗi, bảo trì, thời tiết hoặc sự cố vận hành.",
    isReasonRequired: true,
    title: "Hủy do sự cố sân",
    warning: "Nếu đã thanh toán thành công, backend có thể tạo refund 100% theo chính sách lỗi vận hành."
  };
}

export function ManagerScheduleView({ description, emptyDescription, emptyTitle, fixedStatus, title }: ManagerScheduleViewProps) {
  const { addToast } = useToastStore();
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [courts, setCourts] = useState<ManagerCourtViewModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ManagerScheduleFilterState>({
    ...initialFilters,
    status: fixedStatus ?? "ALL"
  });
  const [items, setItems] = useState<ManagerBookingItemViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const selectedStatus = fixedStatus ?? (filters.status === "ALL" ? undefined : filters.status);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setError(null);
      setIsLoading(true);

      try {
        const [loadedItems, loadedCourts] = await Promise.all([
          getManagerTodaySchedule({ courtId: filters.courtId || undefined, status: selectedStatus }),
          listManagerCourts()
        ]);

        if (!isMounted) {
          return;
        }

        setItems(loadedItems);
        setCourts(loadedCourts);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [filters.courtId, reloadKey, selectedStatus]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => matchesKeyword(item, filters.keyword) && matchesTimeRange(item, filters.timeRange)),
    [filters.keyword, filters.timeRange, items]
  );

  async function handleActionConfirm(reason: string) {
    if (!activeAction) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeAction.mode === "CHECK_IN") {
        await checkInBookingItem(activeAction.item.bookingItemId);
      } else if (activeAction.mode === "OVERRIDE_CHECK_IN") {
        await overrideLateCheckIn(activeAction.item.bookingItemId, { reason });
      } else if (activeAction.mode === "NO_SHOW") {
        await markNoShow(activeAction.item.bookingItemId, { reason });
      } else if (activeAction.mode === "OVERRIDE_COMPLETE") {
        await overrideComplete(activeAction.item.bookingItemId, { reason });
      } else {
        await managerCancelBooking(activeAction.item.bookingOrderId, { reason });
      }

      addToast({
        message: "Danh sách đã được tải lại.",
        title: "Thao tác thành công",
        type: "success"
      });
      setActiveAction(null);
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      addToast({
        message: getErrorMessage(actionError),
        title: "Không thể xử lý",
        type: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const dialogConfig = activeAction ? getDialogConfig(activeAction) : null;

  return (
    <div className="manager-page">
      <ManagerNavigation />

      <section className="listing-header manager-header">
        <div>
          <p className="eyebrow">Field Manager</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
          <RefreshCw aria-hidden="true" size={16} />
          Tải lại
        </Button>
      </section>

      {!fixedStatus ? (
        <ManagerStatusTabs
          value={filters.status as ManagerStatusTabValue}
          onChange={(status) => setFilters((current) => ({ ...current, status }))}
        />
      ) : null}

      <ManagerScheduleFilters courts={courts} value={filters} onChange={setFilters} />

      {isLoading ? <LoadingState message="Đang tải lịch vận hành..." /> : null}
      {error && !isLoading ? (
        <ErrorState
          actionLabel="Tải lại"
          message={error}
          title="Không tải được lịch quản lý"
          onAction={() => setReloadKey((value) => value + 1)}
        />
      ) : null}
      {!isLoading && !error && filteredItems.length === 0 ? <EmptyState title={emptyTitle} message={emptyDescription} /> : null}

      {!isLoading && !error && filteredItems.length > 0 ? (
        <div className="manager-booking-grid">
          {filteredItems.map((item) => (
            <ManagerBookingItemCard
              item={item}
              key={item.bookingItemId}
              onCancelBooking={(selectedItem) => setActiveAction({ item: selectedItem, mode: "CANCEL_BOOKING" })}
              onCheckIn={(selectedItem) => setActiveAction({ item: selectedItem, mode: "CHECK_IN" })}
              onNoShow={(selectedItem) => setActiveAction({ item: selectedItem, mode: "NO_SHOW" })}
              onOverrideCheckIn={(selectedItem) => setActiveAction({ item: selectedItem, mode: "OVERRIDE_CHECK_IN" })}
              onOverrideComplete={(selectedItem) => setActiveAction({ item: selectedItem, mode: "OVERRIDE_COMPLETE" })}
            />
          ))}
        </div>
      ) : null}

      {activeAction && dialogConfig ? (
        <ManagerActionDialog
          confirmLabel={dialogConfig.confirmLabel}
          description={dialogConfig.description}
          isReasonRequired={dialogConfig.isReasonRequired}
          isSubmitting={isSubmitting}
          title={dialogConfig.title}
          warning={dialogConfig.warning}
          onClose={() => setActiveAction(null)}
          onConfirm={handleActionConfirm}
        />
      ) : null}
    </div>
  );
}
