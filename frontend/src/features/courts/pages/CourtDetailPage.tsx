import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, MapPin, UsersRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Badge } from "../../../components/common/Badge";
import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { CourtStatusBadge } from "../../../components/courts/CourtStatusBadge";
import { CourtTagBadge } from "../../../components/courts/CourtTagBadge";
import { FavoriteButton } from "../../../components/courts/FavoriteButton";
import { ShareButton } from "../../../components/courts/ShareButton";
import { buildBookingCreateSelectionPath, ROUTE_PATHS } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { AvailabilityDatePicker } from "../components/AvailabilityDatePicker";
import { AvailabilityWeekGrid } from "../components/AvailabilityWeekGrid";
import { CourtPolicyPanel } from "../components/CourtPolicyPanel";
import { CourtPriceSummary } from "../components/CourtPriceSummary";
import { saveBookingSelection } from "../../bookings/utils/bookingSelectionStorage";
import { getCourtAvailability } from "../services/availabilityService";
import { getCourtById } from "../services/courtService";
import { joinWaitlist } from "../services/waitlistService";
import type { AvailabilitySlotViewModel, CourtAvailabilityViewModel } from "../types/availability.types";
import type { CourtDetailViewModel } from "../types/court-detail.types";
import { getDefaultAvailabilityDate, toDateInputValue } from "../utils/dateUtils";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit"
});

function getAvailabilityText(court: CourtDetailViewModel): string {
  if (court.status === "ACTIVE") {
    return "Xem lịch trống";
  }

  if (court.status === "MAINTENANCE") {
    return "Bảo trì";
  }

  if (court.status === "TEMP_CLOSED") {
    return "Tạm đóng";
  }

  return "Ngừng sử dụng";
}

function isPastDate(date: string, minDate: string): boolean {
  return date < minDate;
}

function parseDateInput(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getWeekStartDate(date: string): string {
  const parsedDate = parseDateInput(date);
  const day = parsedDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return toDateInputValue(addDays(parsedDate, diffToMonday));
}

function getWeekDates(weekStartDate: string): string[] {
  const weekStart = parseDateInput(weekStartDate);
  return Array.from({ length: 7 }, (_, index) => toDateInputValue(addDays(weekStart, index)));
}

export function CourtDetailPage() {
  const navigate = useNavigate();
  const { courtId } = useParams<{ courtId: string }>();
  const { addToast } = useToastStore();
  const todayDate = useMemo(() => toDateInputValue(new Date()), []);
  const defaultAvailabilityDate = useMemo(() => getDefaultAvailabilityDate(), []);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityReloadKey, setAvailabilityReloadKey] = useState(0);
  const [court, setCourt] = useState<CourtDetailViewModel | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningWaitlistSlotId, setJoiningWaitlistSlotId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedDate, setSelectedDate] = useState(defaultAvailabilityDate);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [visibleEndTime, setVisibleEndTime] = useState("23:00");
  const [visibleStartTime, setVisibleStartTime] = useState("07:00");
  const [weekAvailabilities, setWeekAvailabilities] = useState<CourtAvailabilityViewModel[]>([]);
  const weekStartDate = useMemo(() => getWeekStartDate(selectedDate), [selectedDate]);

  useEffect(() => {
    let isMounted = true;

    async function loadCourt() {
      if (!courtId) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const loadedCourt = await getCourtById(courtId);

      if (!isMounted) {
        return;
      }

      setCourt(loadedCourt);
      setIsFavorite(Boolean(loadedCourt?.isFavorite));
      setNotFound(!loadedCourt);
      setIsLoading(false);
    }

    void loadCourt();

    return () => {
      isMounted = false;
    };
  }, [courtId]);

  useEffect(() => {
    if (court?.openTime) {
      setVisibleStartTime(court.openTime);
    }

    if (court?.closeTime) {
      setVisibleEndTime(court.closeTime);
    }
  }, [court?.closeTime, court?.openTime]);

  useEffect(() => {
    let isMounted = true;

    async function loadAvailabilityWeek() {
      if (!court) {
        return;
      }

      if (isPastDate(selectedDate, todayDate)) {
        setDateError("Vui lòng chọn một ngày hợp lệ.");
        setWeekAvailabilities([]);
        setAvailabilityError(null);
        setIsLoadingAvailability(false);
        setSelectedSlotIds([]);
        return;
      }

      setDateError(null);
      setAvailabilityError(null);
      setIsLoadingAvailability(true);
      setSelectedSlotIds([]);

      try {
        const loadedAvailabilities = await Promise.all(
          getWeekDates(weekStartDate).map((date) => getCourtAvailability({ court, date }))
        );

        if (!isMounted) {
          return;
        }

        setWeekAvailabilities(loadedAvailabilities);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setWeekAvailabilities([]);
        setAvailabilityError(getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoadingAvailability(false);
        }
      }
    }

    void loadAvailabilityWeek();

    return () => {
      isMounted = false;
    };
  }, [availabilityReloadKey, court, selectedDate, todayDate, weekStartDate]);

  const allWeekSlots = useMemo(
    () => weekAvailabilities.flatMap((availability) => availability.slots),
    [weekAvailabilities]
  );
  const selectedSlots = useMemo(
    () => allWeekSlots.filter((slot) => selectedSlotIds.includes(slot.id)),
    [allWeekSlots, selectedSlotIds]
  );
  const availabilityPolicy = weekAvailabilities[0]?.policy;
  const availableSlotCount = allWeekSlots.filter((slot) => slot.isAvailable).length;

  if (isLoading) {
    return <LoadingState message="Đang tải chi tiết sân..." title="Chi tiết sân" />;
  }

  if (notFound || !court) {
    return (
      <ErrorState
        actionLabel="Về danh sách sân"
        message="Không tìm thấy sân cần hiển thị hoặc sân đã được gỡ khỏi danh sách."
        title="Không tìm thấy sân"
        onAction={() => navigate(ROUTE_PATHS.courts)}
      />
    );
  }

  const canBook = court.status === "ACTIVE";
  const canContinueBooking = canBook && selectedSlots.length > 0;

  const handleSelectSlot = (slot: AvailabilitySlotViewModel) => {
    if (!slot.isAvailable) {
      addToast({
        type: "warning",
        title: "Khung giờ không khả dụng",
        message: slot.reasonText ?? "Khung giờ này hiện không khả dụng."
      });
      return;
    }

    setSelectedSlotIds((currentIds) =>
      currentIds.includes(slot.id) ? currentIds.filter((slotId) => slotId !== slot.id) : [...currentIds, slot.id]
    );
  };

  const handleJoinWaitlist = async (slot: AvailabilitySlotViewModel) => {
    if (!availabilityPolicy?.canJoinWaitlist) {
      addToast({
        type: "warning",
        title: "Không thể tham gia hàng chờ",
        message: "Nhóm tài khoản hiện tại chưa được phép tham gia hàng chờ."
      });
      return;
    }

    setJoiningWaitlistSlotId(slot.id);
    try {
      await joinWaitlist({
        courtId: slot.courtId,
        startDatetime: slot.startDatetime,
        endDatetime: slot.endDatetime
      });

      addToast({
        type: "success",
        title: "Đã tham gia hàng chờ",
        message: `${slot.startTimeText} - ${slot.endTimeText}. Hệ thống sẽ thông báo khi khung giờ được mở lại.`
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Không thể tham gia hàng chờ",
        message: getErrorMessage(error)
      });
    } finally {
      setJoiningWaitlistSlotId(null);
    }
  };

  const handleBookingIntent = () => {
    if (!canBook) {
      addToast({
        type: "warning",
        title: "Sân không khả dụng",
        message: "Chỉ sân đang hoạt động mới có thể đặt lịch."
      });
      return;
    }

    if (selectedSlots.length === 0) {
      addToast({
        type: "info",
        title: "Chọn khung giờ",
        message: "Vui lòng chọn ít nhất một khung giờ còn trống trước khi đặt lịch."
      });
      return;
    }

    addToast({
      type: "info",
      title: "Chuẩn bị đặt lịch",
      message: "Chuyển sang bước tạo giữ chỗ."
    });
    const selectionId = saveBookingSelection(court.id, selectedSlots);
    navigate(buildBookingCreateSelectionPath({ courtId: court.id, selectionId }));
  };

  return (
    <section className="page-stack">
      <div className="detail-topbar">
        <Link className="ui-button ui-button--ghost ui-button--md" to={ROUTE_PATHS.courts}>
          <ArrowLeft aria-hidden="true" size={18} />
          Quay lại
        </Link>
        <div className="detail-actions">
          <FavoriteButton isFavorite={isFavorite} onClick={() => setIsFavorite((current) => !current)} />
          <ShareButton
            onClick={() =>
              addToast({
                type: "info",
                title: "Chia sẻ sân",
                message: `Đã chọn chia sẻ ${court.name}.`
              })
            }
          />
        </div>
      </div>

      <div className="court-detail-hero">
        <div className="court-detail-hero__media">
          {court.imageUrl ? (
            <img alt={`Ảnh sân ${court.name}`} src={court.imageUrl} />
          ) : (
            <div className="court-detail-hero__placeholder" aria-hidden="true">
              <span>{court.name.slice(0, 2).toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="court-detail-hero__content">
          <div className="court-detail-hero__badges">
            <CourtStatusBadge status={court.status} />
            {court.hasPromotion ? <Badge tone="warning">Ưu đãi</Badge> : null}
          </div>
          <p className="eyebrow">{court.courtType}</p>
          <h1>{court.name}</h1>
          <p>{court.description}</p>

          <div className="detail-meta-grid">
            {court.address ? (
              <div>
                <MapPin aria-hidden="true" size={20} />
                <span>Vị trí</span>
                <strong>{court.address}</strong>
              </div>
            ) : null}
            {typeof court.capacity === "number" ? (
              <div>
                <UsersRound aria-hidden="true" size={20} />
                <span>Sức chứa</span>
                <strong>{court.capacity} người</strong>
              </div>
            ) : null}
            {court.openTime && court.closeTime ? (
              <div>
                <Clock aria-hidden="true" size={20} />
                <span>Giờ mở cửa</span>
                <strong>
                  {court.openTime} - {court.closeTime}
                </strong>
              </div>
            ) : null}
          </div>

          <Button
            disabled={!canBook}
            onClick={() => {
              document.getElementById("court-availability")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            {getAvailabilityText(court)}
          </Button>
        </div>
      </div>

      <Card as="section" className="detail-card detail-card--wide availability-panel" id="court-availability">
        <div className="availability-header">
          <div>
            <p className="eyebrow">Lịch trống</p>
            <h2>Chọn tuần và khung giờ</h2>
            <p>Ô xanh có thể chọn nhiều slot. Ô đóng cửa thể hiện thời gian sân không hoạt động theo cấu hình thật.</p>
          </div>
          <div className="availability-controls">
            <AvailabilityDatePicker
              error={dateError}
              minDate={todayDate}
              value={selectedDate}
              onChange={setSelectedDate}
            />
            <label className="availability-time-control">
              <span>Từ giờ</span>
              <input type="time" value={visibleStartTime} onChange={(event) => setVisibleStartTime(event.target.value)} />
            </label>
            <label className="availability-time-control">
              <span>Đến giờ</span>
              <input type="time" value={visibleEndTime} onChange={(event) => setVisibleEndTime(event.target.value)} />
            </label>
          </div>
        </div>

        {!canBook ? (
          <p className="availability-warning" role="status">
            Sân không ở trạng thái hoạt động nên tất cả khung giờ đặt lịch đều bị khóa.
          </p>
        ) : null}

        {isLoadingAvailability ? (
          <LoadingState compact message="Đang tải lịch trống..." />
        ) : availabilityError ? (
          <ErrorState
            compact
            actionLabel="Thử lại"
            message={availabilityError}
            title="Không tải được lịch trống"
            onAction={() => setAvailabilityReloadKey((key) => key + 1)}
          />
        ) : weekAvailabilities.length ? (
          <AvailabilityWeekGrid
            availabilities={weekAvailabilities}
            canJoinWaitlist={canBook && Boolean(availabilityPolicy?.canJoinWaitlist)}
            joiningWaitlistSlotId={joiningWaitlistSlotId}
            selectedDate={selectedDate}
            selectedSlotIds={selectedSlotIds}
            visibleEndTime={visibleEndTime}
            visibleStartTime={visibleStartTime}
            weekStartDate={weekStartDate}
            onJoinWaitlist={handleJoinWaitlist}
            onSelectSlot={handleSelectSlot}
          />
        ) : null}

        <div className="booking-intent">
          <div>
            <span>Khung giờ đã chọn</span>
            <strong>
              {selectedSlots.length
                ? `${selectedSlots.length} slot: ${selectedSlots
                    .map((slot) => `${shortDateFormatter.format(new Date(slot.startDatetime))} ${slot.startTimeText}-${slot.endTimeText}`)
                    .join(", ")}`
                : "Chưa chọn khung giờ"}
            </strong>
          </div>
          <Button disabled={!canContinueBooking} onClick={handleBookingIntent}>
            Đặt lịch
          </Button>
        </div>
      </Card>

      <div className="court-detail-grid">
        <Card as="section" className="detail-card">
          <h2>Thông tin sân</h2>
          <dl className="detail-list">
            <div>
              <dt>Loại sân</dt>
              <dd>{court.courtType}</dd>
            </div>
            {court.area ? (
              <div>
                <dt>Khu vực</dt>
                <dd>{court.area}</dd>
              </div>
            ) : null}
            <div>
              <dt>Giá tham khảo</dt>
              <dd>{court.startingPrice ? `Từ ${currencyFormatter.format(court.startingPrice)}` : "Chưa có dữ liệu"}</dd>
            </div>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                <CourtStatusBadge status={court.status} />
              </dd>
            </div>
          </dl>
        </Card>

        <Card as="section" className="detail-card">
          <h2>Khung giờ hoạt động</h2>
          <div className="operating-hours-list">
            {court.operatingHours.map((hour) => (
              <div key={`${hour.weekday}-${hour.openTime}`}>
                <span>{hour.weekday}</span>
                <strong>
                  {hour.openTime} - {hour.closeTime}
                </strong>
              </div>
            ))}
          </div>
        </Card>

        <Card as="section" className="detail-card detail-card--wide">
          <h2>Tiện ích và tag</h2>
          {court.amenities.length ? (
            <div className="amenity-list">
              {court.amenities.map((amenity) => (
                <Badge key={amenity} tone="neutral">
                  {amenity}
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="court-card__tags">
            {court.tags.map((tag) => (
              <CourtTagBadge key={tag} tag={tag} />
            ))}
          </div>
        </Card>

        {weekAvailabilities.length ? (
          <>
            <CourtPriceSummary
              availableSlotCount={availableSlotCount}
              selectedSlots={selectedSlots}
            />
            {availabilityPolicy ? <CourtPolicyPanel policy={availabilityPolicy} /> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
