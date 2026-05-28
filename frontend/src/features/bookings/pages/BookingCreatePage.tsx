import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../../../components/common/Button";
import { Card } from "../../../components/common/Card";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { AvailabilityDatePicker } from "../../courts/components/AvailabilityDatePicker";
import { AvailabilitySlotPicker } from "../../courts/components/AvailabilitySlotPicker";
import { CourtPolicyPanel } from "../../courts/components/CourtPolicyPanel";
import { getCourtAvailability } from "../../courts/services/availabilityService";
import { getCourtById } from "../../courts/services/courtService";
import type { AvailabilitySlotViewModel, CourtAvailabilityViewModel } from "../../courts/types/availability.types";
import type { CourtDetailViewModel } from "../../courts/types/court-detail.types";
import { dateFromIsoOrDefault, toDateInputValue } from "../../courts/utils/dateUtils";
import { buildBookingPaymentPath, ROUTE_PATHS } from "../../../routes/route-paths";
import { useToastStore } from "../../../stores/toast.store";
import { getErrorMessage } from "../../../utils/format-error";
import { BookingSummaryCard } from "../components/BookingSummaryCard";
import { createBooking } from "../services/bookingService";
import { createBookingFormSchema } from "../schemas/bookingSchemas";

export function BookingCreatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const todayDate = useMemo(() => toDateInputValue(new Date()), []);
  const courtId = searchParams.get("courtId") ?? "";
  const initialStart = searchParams.get("start");
  const initialEnd = searchParams.get("end");
  const [availability, setAvailability] = useState<CourtAvailabilityViewModel | null>(null);
  const [court, setCourt] = useState<CourtDetailViewModel | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") ?? dateFromIsoOrDefault(initialStart));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCourtAndAvailability() {
      if (!courtId) {
        setError("Thiếu thông tin sân để tạo đơn đặt.");
        setIsLoading(false);
        return;
      }

      if (selectedDate < todayDate) {
        setDateError("Vui lòng chọn một ngày hợp lệ.");
        setAvailability(null);
        setIsLoading(false);
        return;
      }

      setDateError(null);
      setError(null);
      setIsLoading(true);

      try {
        const loadedCourt = await getCourtById(courtId);
        if (!loadedCourt) {
          throw new Error("Không tìm thấy sân cần đặt.");
        }

        const loadedAvailability = await getCourtAvailability({ court: loadedCourt, date: selectedDate });

        if (!isMounted) {
          return;
        }

        setCourt(loadedCourt);
        setAvailability(loadedAvailability);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setCourt(null);
        setAvailability(null);
        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCourtAndAvailability();

    return () => {
      isMounted = false;
    };
  }, [courtId, selectedDate, todayDate]);

  useEffect(() => {
    if (!availability) {
      setSelectedSlotId(null);
      return;
    }

    const initialSlot = availability.slots.find(
      (slot) => slot.startDatetime === initialStart && slot.endDatetime === initialEnd && slot.isAvailable
    );
    setSelectedSlotId(initialSlot?.id ?? null);
  }, [availability, initialEnd, initialStart]);

  const selectedSlot = useMemo(
    () => availability?.slots.find((slot) => slot.id === selectedSlotId) ?? null,
    [availability?.slots, selectedSlotId]
  );

  const handleSelectSlot = (slot: AvailabilitySlotViewModel) => {
    if (!slot.isAvailable) {
      addToast({
        type: "warning",
        title: "Khung giờ không khả dụng",
        message: slot.reasonText ?? "Vui lòng chọn khung giờ khác."
      });
      return;
    }

    setSelectedSlotId(slot.id);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!court || !selectedSlot) {
      setError("Vui lòng chọn sân và khung giờ còn trống.");
      return;
    }

    if (court.status !== "ACTIVE") {
      setError("Chỉ sân đang hoạt động mới có thể đặt lịch.");
      return;
    }

    const parsedValues = createBookingFormSchema.safeParse({
      courtId: court.id,
      startDatetime: selectedSlot.startDatetime,
      endDatetime: selectedSlot.endDatetime,
      note
    });

    if (!parsedValues.success) {
      setError(parsedValues.error.issues[0]?.message ?? "Thông tin đặt sân chưa hợp lệ.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const booking = await createBooking({
        items: [
          {
            courtId: parsedValues.data.courtId,
            startDatetime: parsedValues.data.startDatetime,
            endDatetime: parsedValues.data.endDatetime
          }
        ],
        note: parsedValues.data.note
      });

      addToast({ type: "success", title: "Đã tạo giữ chỗ", message: "Vui lòng thanh toán trong thời gian giữ chỗ." });
      navigate(buildBookingPaymentPath(booking.bookingOrderId), { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState title="Tạo đặt sân" message="Đang tải thông tin sân và lịch trống..." />;
  }

  if (error && !court) {
    return (
      <ErrorState
        actionLabel="Về danh sách sân"
        message={error}
        title="Không thể tạo đặt sân"
        onAction={() => navigate(ROUTE_PATHS.courts)}
      />
    );
  }

  return (
    <section className="page-stack">
      <Link className="ui-button ui-button--ghost ui-button--md" to={court ? `/courts/${court.id}` : ROUTE_PATHS.courts}>
        <ArrowLeft aria-hidden="true" size={18} />
        Quay lại
      </Link>

      <div className="booking-create-layout">
        <form className="booking-form-panel" onSubmit={handleSubmit}>
          <Card as="section" className="detail-card">
            <div>
              <p className="eyebrow">Tạo giữ chỗ</p>
              <h1>Hoàn tất thông tin đặt sân</h1>
              <p className="muted-copy">Đơn mới sẽ ở trạng thái chờ thanh toán. Booking chỉ được xác nhận sau khi thanh toán thành công.</p>
            </div>

            {error ? <p className="form-alert" role="alert">{error}</p> : null}

            <AvailabilityDatePicker
              error={dateError}
              minDate={todayDate}
              value={selectedDate}
              onChange={setSelectedDate}
            />

            {availability ? (
              <AvailabilitySlotPicker
                selectedSlotId={selectedSlotId}
                slots={availability.slots}
                onSelectSlot={handleSelectSlot}
              />
            ) : null}

            <label className="form-field">
              <span>Mục đích sử dụng</span>
              <textarea
                maxLength={500}
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>

            <Button disabled={isSubmitting || !selectedSlot || court?.status !== "ACTIVE"} size="lg" type="submit">
              <CalendarClock aria-hidden="true" size={18} />
              {isSubmitting ? "Đang tạo giữ chỗ..." : "Tạo giữ chỗ"}
            </Button>
          </Card>
        </form>

        <aside className="booking-side-panel">
          <BookingSummaryCard court={court} policy={availability?.policy} slot={selectedSlot} />
          {availability ? <CourtPolicyPanel policy={availability.policy} /> : null}
        </aside>
      </div>
    </section>
  );
}
