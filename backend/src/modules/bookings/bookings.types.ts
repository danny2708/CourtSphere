import type { BookingStatus } from "@prisma/client";

export type CreateBookingInput = {
  courtId: string;
  startDatetime: Date;
  endDatetime: Date;
  participantCount: number;
  usagePurpose: string;
};

export type ListMyBookingsQuery = {
  status?: BookingStatus;
  fromDate?: Date;
  toDate?: Date;
};

export type CancelBookingInput = {
  reason?: string;
};

