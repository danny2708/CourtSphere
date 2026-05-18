import { BookingStatus } from "@prisma/client";

import type {
  AvailabilitySlotStatus,
  BookingConflictCandidate,
  SlotWindow
} from "./availability.types";

export const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING,
  BookingStatus.CONFIRMED,
  BookingStatus.IN_USE
] as const;

type ConflictResult = {
  bookingId: string;
  status: Exclude<AvailabilitySlotStatus, "AVAILABLE" | "MAINTENANCE" | "CLOSED">;
};

export class BookingConflictService {
  overlaps(slot: SlotWindow, booking: Pick<BookingConflictCandidate, "startDatetime" | "endDatetime">): boolean {
    return slot.startDatetime < booking.endDatetime && slot.endDatetime > booking.startDatetime;
  }

  isBookingOccupyingSlot(booking: BookingConflictCandidate, now: Date): boolean {
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.bookingStatus as (typeof ACTIVE_BOOKING_STATUSES)[number])) {
      return false;
    }

    if (
      booking.bookingStatus === BookingStatus.PENDING_PAYMENT &&
      booking.holdExpiresAt &&
      booking.holdExpiresAt <= now
    ) {
      return false;
    }

    return true;
  }

  findConflict(
    slot: SlotWindow,
    bookings: BookingConflictCandidate[],
    now: Date
  ): ConflictResult | null {
    const overlappingBookings = bookings.filter(
      (booking) => this.isBookingOccupyingSlot(booking, now) && this.overlaps(slot, booking)
    );

    if (overlappingBookings.length === 0) {
      return null;
    }

    const booked = overlappingBookings.find(
      (booking) => booking.bookingStatus !== BookingStatus.PENDING_PAYMENT
    );

    if (booked) {
      return {
        bookingId: booked.bookingId,
        status: "BOOKED"
      };
    }

    return {
      bookingId: overlappingBookings[0].bookingId,
      status: "HOLD"
    };
  }
}

export const bookingConflictService = new BookingConflictService();
