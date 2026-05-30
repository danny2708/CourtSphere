import { apiRequest } from "../../../api/client";
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
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh"
});

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
    slots: response.slots.map((slot) => mapApiSlot(response.court.id, slot))
  };
}

export async function getCourtAvailability(input: {
  court: CourtDetailViewModel;
  date: string;
}): Promise<CourtAvailabilityViewModel> {
  const response = await apiRequest<AvailabilityApiResponse>(
    `/api/courts/${input.court.id}/availability?date=${encodeURIComponent(input.date)}&includePricing=true`,
    {
      auth: true,
      method: "GET"
    }
  );

  return mapApiResponse(response);
}
