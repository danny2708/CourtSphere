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
import { ROUTE_PATHS } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { AvailabilityDatePicker } from "../components/AvailabilityDatePicker";
import { AvailabilitySlotPicker } from "../components/AvailabilitySlotPicker";
import { CourtPolicyPanel } from "../components/CourtPolicyPanel";
import { CourtPriceSummary } from "../components/CourtPriceSummary";
import { getCourtAvailability } from "../services/availabilityService";
import { getCourtById } from "../services/courtService";
import type { AvailabilitySlotViewModel, CourtAvailabilityViewModel } from "../types/availability.types";
import type { CourtDetailViewModel } from "../types/court-detail.types";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
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

function toDateInputValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 10);
}

function isPastDate(date: string, minDate: string): boolean {
  return date < minDate;
}

export function CourtDetailPage() {
  const navigate = useNavigate();
  const { courtId } = useParams<{ courtId: string }>();
  const { addToast } = useToastStore();
  const todayDate = useMemo(() => toDateInputValue(new Date()), []);
  const [availability, setAvailability] = useState<CourtAvailabilityViewModel | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityReloadKey, setAvailabilityReloadKey] = useState(0);
  const [court, setCourt] = useState<CourtDetailViewModel | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

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
    let isMounted = true;

    async function loadAvailability() {
      if (!court) {
        return;
      }

      if (isPastDate(selectedDate, todayDate)) {
        setDateError("Vui lòng chọn một ngày hợp lệ.");
        setAvailability(null);
        setAvailabilityError(null);
        setIsLoadingAvailability(false);
        setSelectedSlotId(null);
        return;
      }

      setDateError(null);
      setAvailabilityError(null);
      setIsLoadingAvailability(true);
      setSelectedSlotId(null);

      try {
        const loadedAvailability = await getCourtAvailability({ court, date: selectedDate });

        if (!isMounted) {
          return;
        }

        setAvailability(loadedAvailability);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setAvailability(null);
        setAvailabilityError(getErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoadingAvailability(false);
        }
      }
    }

    void loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [availabilityReloadKey, court, selectedDate, todayDate]);

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
  const selectedSlot = useMemo(
    () => availability?.slots.find((slot) => slot.id === selectedSlotId) ?? null,
    [availability?.slots, selectedSlotId]
  );
  const availableSlotCount = availability?.slots.filter((slot) => slot.isAvailable).length ?? 0;
  const canContinueBooking = canBook && Boolean(selectedSlot?.isAvailable);

  const handleSelectSlot = (slot: AvailabilitySlotViewModel) => {
    if (!slot.isAvailable) {
      addToast({
        type: "warning",
        title: "Khung giờ không khả dụng",
        message: slot.reasonText ?? "Khung giờ này hiện không khả dụng."
      });
      return;
    }

    setSelectedSlotId(slot.id);
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

    if (!selectedSlot) {
      addToast({
        type: "info",
        title: "Chọn khung giờ",
        message: "Vui lòng chọn một khung giờ còn trống trước khi đặt lịch."
      });
      return;
    }

    addToast({
      type: "info",
      title: "Chuẩn bị đặt lịch",
      message: "Tạo booking hold sẽ được triển khai ở module 7.5 Booking pages."
    });
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
            <div>
              <MapPin aria-hidden="true" size={20} />
              <span>Vị trí</span>
              <strong>{court.address}</strong>
            </div>
            <div>
              <UsersRound aria-hidden="true" size={20} />
              <span>Sức chứa</span>
              <strong>{court.capacity} người</strong>
            </div>
            <div>
              <Clock aria-hidden="true" size={20} />
              <span>Giờ mở cửa</span>
              <strong>
                {court.openTime} - {court.closeTime}
              </strong>
            </div>
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
            <h2>Chọn ngày và khung giờ</h2>
            <p>Slot còn trống có thể chọn để chuẩn bị đặt lịch. Booking hold và thanh toán sẽ được xử lý ở module sau.</p>
          </div>
          <AvailabilityDatePicker
            error={dateError}
            minDate={todayDate}
            value={selectedDate}
            onChange={setSelectedDate}
          />
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
        ) : availability ? (
          <AvailabilitySlotPicker
            selectedSlotId={selectedSlotId}
            slots={availability.slots}
            onSelectSlot={handleSelectSlot}
          />
        ) : null}

        <div className="booking-intent">
          <div>
            <span>Khung giờ đã chọn</span>
            <strong>{selectedSlot ? `${selectedSlot.startTimeText} - ${selectedSlot.endTimeText}` : "Chưa chọn khung giờ"}</strong>
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
            <div>
              <dt>Khu vực</dt>
              <dd>{court.area}</dd>
            </div>
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
          <div className="amenity-list">
            {court.amenities.map((amenity) => (
              <Badge key={amenity} tone="neutral">
                {amenity}
              </Badge>
            ))}
          </div>
          <div className="court-card__tags">
            {court.tags.map((tag) => (
              <CourtTagBadge key={tag} tag={tag} />
            ))}
          </div>
        </Card>

        {availability ? (
          <>
            <CourtPriceSummary
              availableSlotCount={availableSlotCount}
              selectedSlot={selectedSlot}
              source={availability.source}
            />
            <CourtPolicyPanel policy={availability.policy} />
          </>
        ) : null}
      </div>
    </section>
  );
}
