import { BookingStatus, Prisma } from "@prisma/client";

import { bookingStateService, type BookingStateService } from "../modules/bookings/booking-state.service";

const aggregateMutableOrderStatuses: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_USE,
  BookingStatus.CHECKIN_EXPIRED
];

async function updateOrderStatus(
  tx: Prisma.TransactionClient,
  state: BookingStateService,
  input: {
    bookingOrderId: string;
    oldStatus: BookingStatus;
    newStatus: BookingStatus;
    actionType: string;
    actionByUserId?: string | null;
    note: string;
  }
): Promise<boolean> {
  const updatedOrder = await tx.bookingOrder.updateMany({
    where: {
      bookingOrderId: input.bookingOrderId,
      bookingStatus: input.oldStatus
    },
    data: {
      bookingStatus: input.newStatus
    }
  });

  if (updatedOrder.count === 0) {
    return false;
  }

  await state.recordOrderStatusHistory(tx, {
    bookingOrderId: input.bookingOrderId,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    actionType: input.actionType,
    actionByUserId: input.actionByUserId ?? null,
    note: input.note
  });

  return true;
}

export async function recomputeBookingOrderStatus(
  tx: Prisma.TransactionClient,
  input: {
    bookingOrderId: string;
    actionByUserId?: string | null;
    state?: BookingStateService;
  }
): Promise<boolean> {
  const state = input.state ?? bookingStateService;
  const order = await tx.bookingOrder.findUnique({
    where: {
      bookingOrderId: input.bookingOrderId
    },
    select: {
      bookingOrderId: true,
      bookingStatus: true,
      items: {
        select: {
          bookingStatus: true
        }
      }
    }
  });

  if (!order || order.items.length === 0) {
    return false;
  }

  if (!aggregateMutableOrderStatuses.includes(order.bookingStatus)) {
    return false;
  }

  if (
    order.items.every((item) => item.bookingStatus === BookingStatus.COMPLETED) &&
    order.bookingStatus !== BookingStatus.COMPLETED
  ) {
    return updateOrderStatus(tx, state, {
      bookingOrderId: input.bookingOrderId,
      oldStatus: order.bookingStatus,
      newStatus: BookingStatus.COMPLETED,
      actionType: "ALL_BOOKING_ITEMS_COMPLETED",
      actionByUserId: input.actionByUserId ?? null,
      note: "All booking items are completed"
    });
  }

  if (
    order.items.every((item) => item.bookingStatus === BookingStatus.CHECKIN_EXPIRED) &&
    order.bookingStatus === BookingStatus.CONFIRMED
  ) {
    return updateOrderStatus(tx, state, {
      bookingOrderId: input.bookingOrderId,
      oldStatus: BookingStatus.CONFIRMED,
      newStatus: BookingStatus.CHECKIN_EXPIRED,
      actionType: "ALL_BOOKING_ITEMS_CHECKIN_EXPIRED",
      actionByUserId: input.actionByUserId ?? null,
      note: "All booking items exceeded the check-in window"
    });
  }

  if (
    order.items.some((item) => item.bookingStatus === BookingStatus.IN_USE) &&
    order.bookingStatus === BookingStatus.CONFIRMED
  ) {
    return updateOrderStatus(tx, state, {
      bookingOrderId: input.bookingOrderId,
      oldStatus: BookingStatus.CONFIRMED,
      newStatus: BookingStatus.IN_USE,
      actionType: "BOOKING_ITEM_IN_USE",
      actionByUserId: input.actionByUserId ?? null,
      note: "At least one booking item is in use"
    });
  }

  return false;
}
