export type AvailabilitySlotStatus = "AVAILABLE" | "BOOKED" | "HOLD" | "MAINTENANCE" | "CLOSED";

export type AvailabilityQuery = {
  date: string;
  durationMinutes?: number;
  includePricing?: boolean;
};

export type SlotWindow = {
  startDatetime: Date;
  endDatetime: Date;
};

export type AvailabilitySlotDto = {
  startDatetime: string;
  endDatetime: string;
  status: AvailabilitySlotStatus;
  priceAmount?: number;
  bookingOrderId?: string;
  bookingItemId?: string;
  unavailableReason?: string;
};

export type BookingConflictCandidate = {
  bookingOrderId: string;
  bookingItemId: string;
  bookingStatus: string;
  startDatetime: Date;
  endDatetime: Date;
  holdExpiresAt: Date | null;
};
