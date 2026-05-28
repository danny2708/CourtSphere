export type BackendAvailabilitySlotStatus =
  | "AVAILABLE"
  | "BOOKED"
  | "HOLD"
  | "MAINTENANCE"
  | "CLOSED"
  | "PENDING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "CONFIRMED"
  | "IN_USE";

export type AvailabilitySlotStatus =
  | "AVAILABLE"
  | "PENDING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "CONFIRMED"
  | "IN_USE"
  | "UNAVAILABLE";

export type AvailabilityPolicyViewModel = {
  holdMinutes?: number;
  cancelBeforeHours?: number;
  lateCheckinMinutes?: number;
  refundRateUserOnTime?: number;
  refundRateManagerFault?: number;
  maxDurationMinutes?: number;
  maxBookingsPerDay?: number;
  advanceBookingDays?: number;
  canJoinWaitlist?: boolean;
};

export type AvailabilitySlotViewModel = {
  id: string;
  courtId: string;
  startDatetime: string;
  endDatetime: string;
  startTimeText: string;
  endTimeText: string;
  status: AvailabilitySlotStatus;
  isAvailable: boolean;
  priceAmount?: number;
  priceText?: string;
  reasonText?: string;
};

export type CourtAvailabilityViewModel = {
  courtId: string;
  date: string;
  weekday?: number;
  durationMinutes?: number;
  policy: AvailabilityPolicyViewModel;
  slots: AvailabilitySlotViewModel[];
  source: "api" | "mock";
};

export type AvailabilityApiPolicy = {
  holdMinutes?: number;
  cancelBeforeHours?: number;
  lateCheckinMinutes?: number;
  refundRateUserOnTime?: number;
  refundRateManagerFault?: number;
  maxDurationMinutes?: number;
  maxBookingsPerDay?: number;
  advanceBookingDays?: number;
  canJoinWaitlist?: boolean;
};

export type AvailabilityApiSlot = {
  startDatetime: string;
  endDatetime: string;
  status: BackendAvailabilitySlotStatus;
  priceAmount?: number;
  bookingOrderId?: string;
  bookingItemId?: string;
  unavailableReason?: string;
};

export type AvailabilityApiResponse = {
  court: {
    id: string;
    courtName: string;
    status: string;
    courtType?: {
      id: string;
      typeName: string;
    };
  };
  date: string;
  weekday?: number;
  durationMinutes?: number;
  policy?: AvailabilityApiPolicy;
  slots: AvailabilityApiSlot[];
};
