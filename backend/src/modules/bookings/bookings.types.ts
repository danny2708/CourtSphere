import type { BookingStatus } from "@prisma/client";

export type CreateBookingInput = {
  items: Array<{
    courtId: string;
    startDatetime: Date;
    endDatetime: Date;
  }>;
  note?: string;
};

export type ListMyBookingsQuery = {
  status?: BookingStatus;
  fromDate?: Date;
  toDate?: Date;
};

export type CancelBookingInput = {
  reason?: string;
};

