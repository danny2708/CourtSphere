import { apiRequest } from "../../../api/client";
import { ApiClientError } from "../../../types/api.types";
import type { CourtDetailViewModel } from "../types/court-detail.types";
import type {
  AvailabilityApiResponse,
  AvailabilityApiSlot,
  AvailabilityPolicyViewModel,
  AvailabilitySlotStatus,
  AvailabilitySlotViewModel,
  BackendAvailabilitySlotStatus,
  CourtAvailabilityViewModel
} from "../types/availability.types";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit"
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const defaultPolicy: AvailabilityPolicyViewModel = {
  holdMinutes: 10,
  cancelBeforeHours: 2,
  lateCheckinMinutes: 15,
  refundRateUserOnTime: 100,
  refundRateManagerFault: 100,
  maxDurationMinutes: 120,
  maxBookingsPerDay: 2,
  advanceBookingDays: 7,
  canJoinWaitlist: true
};

function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

function formatTime(isoDate: string): string {
  return timeFormatter.format(new Date(isoDate));
}

function formatPrice(priceAmount: number | undefined): string | undefined {
  return priceAmount === undefined ? undefined : currencyFormatter.format(priceAmount);
}

function toReasonText(reason: string | undefined, status: BackendAvailabilitySlotStatus): string | undefined {
  if (!reason) {
    if (status === "BOOKED" || status === "CONFIRMED" || status === "IN_USE") {
      return "Khung giờ đã có người đặt.";
    }

    if (status === "HOLD" || status === "PENDING_PAYMENT" || status === "PAYMENT_PROCESSING") {
      return "Khung giờ đang được giữ chỗ.";
    }

    if (status === "MAINTENANCE") {
      return "Sân đang bảo trì.";
    }

    if (status === "CLOSED") {
      return "Khung giờ không khả dụng.";
    }

    return undefined;
  }

  const reasonMap: Record<string, string> = {
    "Slot is temporarily held pending payment": "Khung giờ đang được giữ chỗ chờ thanh toán.",
    "Slot overlaps active booking": "Khung giờ đã có người đặt.",
    "Court is under maintenance": "Sân đang bảo trì.",
    "Outside advance booking window": "Ngày đặt vượt quá số ngày được phép đặt trước.",
    "Slot is in the past": "Khung giờ đã qua.",
    "Court is closed": "Sân đang tạm đóng hoặc ngừng sử dụng."
  };

  return reasonMap[reason] ?? reason;
}

function normalizeSlotStatus(status: BackendAvailabilitySlotStatus): AvailabilitySlotStatus {
  if (status === "AVAILABLE") {
    return "AVAILABLE";
  }

  if (status === "HOLD") {
    return "PENDING_PAYMENT";
  }

  if (status === "BOOKED") {
    return "CONFIRMED";
  }

  if (status === "PENDING_PAYMENT" || status === "PAYMENT_PROCESSING" || status === "CONFIRMED" || status === "IN_USE") {
    return status;
  }

  return "UNAVAILABLE";
}

function mapApiSlot(courtId: string, slot: AvailabilityApiSlot): AvailabilitySlotViewModel {
  const normalizedStatus = normalizeSlotStatus(slot.status);

  return {
    id: `${courtId}-${slot.startDatetime}`,
    courtId,
    startDatetime: slot.startDatetime,
    endDatetime: slot.endDatetime,
    startTimeText: formatTime(slot.startDatetime),
    endTimeText: formatTime(slot.endDatetime),
    status: normalizedStatus,
    isAvailable: normalizedStatus === "AVAILABLE",
    priceAmount: slot.priceAmount,
    priceText: formatPrice(slot.priceAmount),
    reasonText: toReasonText(slot.unavailableReason, slot.status)
  };
}

function mapApiResponse(response: AvailabilityApiResponse): CourtAvailabilityViewModel {
  return {
    courtId: response.court.id,
    date: response.date,
    weekday: response.weekday,
    durationMinutes: response.durationMinutes,
    policy: {
      ...defaultPolicy,
      ...response.policy
    },
    slots: response.slots.map((slot) => mapApiSlot(response.court.id, slot)),
    source: "api"
  };
}

function buildDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function buildMockSlot(input: {
  court: CourtDetailViewModel;
  date: string;
  startTime: string;
  endTime: string;
  status: AvailabilitySlotStatus;
  reasonText?: string;
  priceAmount?: number;
}): AvailabilitySlotViewModel {
  const startDatetime = buildDateTime(input.date, input.startTime);
  const endDatetime = buildDateTime(input.date, input.endTime);

  return {
    id: `${input.court.id}-${startDatetime}`,
    courtId: input.court.id,
    startDatetime,
    endDatetime,
    startTimeText: input.startTime,
    endTimeText: input.endTime,
    status: input.status,
    isAvailable: input.status === "AVAILABLE",
    priceAmount: input.priceAmount,
    priceText: formatPrice(input.priceAmount),
    reasonText: input.reasonText
  };
}

function buildMockAvailability(court: CourtDetailViewModel, date: string): CourtAvailabilityViewModel {
  const basePrice = court.startingPrice ?? 100000;

  if (court.status !== "ACTIVE") {
    const reasonText =
      court.status === "MAINTENANCE"
        ? "Sân đang bảo trì."
        : court.status === "TEMP_CLOSED"
          ? "Sân đang tạm đóng."
          : "Sân đã ngừng sử dụng.";

    return {
      courtId: court.id,
      date,
      durationMinutes: 60,
      policy: defaultPolicy,
      slots: [
        ["08:00", "09:00"],
        ["09:00", "10:00"],
        ["10:00", "11:00"],
        ["11:00", "12:00"]
      ].map(([startTime, endTime]) =>
        buildMockSlot({
          court,
          date,
          startTime,
          endTime,
          status: "UNAVAILABLE",
          reasonText,
          priceAmount: basePrice
        })
      ),
      source: "mock"
    };
  }

  return {
    courtId: court.id,
    date,
    durationMinutes: 60,
    policy: defaultPolicy,
    slots: [
      buildMockSlot({ court, date, startTime: "08:00", endTime: "09:00", status: "AVAILABLE", priceAmount: basePrice }),
      buildMockSlot({
        court,
        date,
        startTime: "09:00",
        endTime: "10:00",
        status: "PENDING_PAYMENT",
        reasonText: "Khung giờ đang được giữ chỗ chờ thanh toán.",
        priceAmount: basePrice
      }),
      buildMockSlot({
        court,
        date,
        startTime: "10:00",
        endTime: "11:00",
        status: "CONFIRMED",
        reasonText: "Khung giờ đã có người đặt.",
        priceAmount: basePrice
      }),
      buildMockSlot({ court, date, startTime: "11:00", endTime: "12:00", status: "AVAILABLE", priceAmount: basePrice }),
      buildMockSlot({
        court,
        date,
        startTime: "13:00",
        endTime: "14:00",
        status: "UNAVAILABLE",
        reasonText: "Khung giờ không nằm trong cấu hình hoạt động.",
        priceAmount: basePrice
      }),
      buildMockSlot({
        court,
        date,
        startTime: "14:00",
        endTime: "15:00",
        status: "PAYMENT_PROCESSING",
        reasonText: "Khung giờ đang xử lý thanh toán.",
        priceAmount: basePrice
      }),
      buildMockSlot({ court, date, startTime: "16:00", endTime: "17:00", status: "AVAILABLE", priceAmount: basePrice + 20000 })
    ],
    source: "mock"
  };
}

function canFallbackToMock(error: unknown): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  if (error instanceof ApiClientError) {
    return error.status === 404;
  }

  return true;
}

export async function getCourtAvailability(input: {
  court: CourtDetailViewModel;
  date: string;
}): Promise<CourtAvailabilityViewModel> {
  if (!isUuid(input.court.id)) {
    return buildMockAvailability(input.court, input.date);
  }

  try {
    const response = await apiRequest<AvailabilityApiResponse>(
      `/api/courts/${input.court.id}/availability?date=${encodeURIComponent(input.date)}&includePricing=true`,
      {
        auth: true,
        method: "GET"
      }
    );

    return mapApiResponse(response);
  } catch (error) {
    if (canFallbackToMock(error)) {
      return buildMockAvailability(input.court, input.date);
    }

    throw error;
  }
}
