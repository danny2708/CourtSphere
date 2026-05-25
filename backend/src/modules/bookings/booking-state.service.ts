import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";

export class BookingStateService {
  async recordOrderStatusHistory(
    tx: Prisma.TransactionClient,
    input: {
      bookingOrderId: string;
      oldStatus?: BookingStatus | null;
      newStatus: BookingStatus;
      actionType: string;
      actionByUserId?: string | null;
      note?: string | null;
    }
  ): Promise<void> {
    await tx.bookingOrderStatusHistory.create({
      data: {
        bookingOrderId: input.bookingOrderId,
        oldStatus: input.oldStatus ?? null,
        newStatus: input.newStatus,
        actionType: input.actionType,
        actionByUserId: input.actionByUserId ?? null,
        note: input.note ?? null
      }
    });
  }

  async recordItemStatusHistory(
    tx: Prisma.TransactionClient,
    input: {
      bookingItemId: string;
      oldStatus?: BookingStatus | null;
      newStatus: BookingStatus;
      actionType: string;
      actionByUserId?: string | null;
      note?: string | null;
    }
  ): Promise<void> {
    await tx.bookingItemStatusHistory.create({
      data: {
        bookingItemId: input.bookingItemId,
        oldStatus: input.oldStatus ?? null,
        newStatus: input.newStatus,
        actionType: input.actionType,
        actionByUserId: input.actionByUserId ?? null,
        note: input.note ?? null
      }
    });
  }

  async expireOverlappingPaymentHolds(
    tx: Prisma.TransactionClient,
    input: {
      courtId: string;
      startDatetime: Date;
      endDatetime: Date;
      now: Date;
    }
  ): Promise<void> {
    const expiredHolds = await tx.bookingItem.findMany({
      where: {
        courtId: input.courtId,
        bookingStatus: BookingStatus.PENDING_PAYMENT,
        bookingOrder: {
          holdExpiresAt: {
            lte: input.now
          }
        },
        startDatetime: {
          lt: input.endDatetime
        },
        endDatetime: {
          gt: input.startDatetime
        }
      },
      select: {
        bookingItemId: true,
        bookingOrderId: true,
        bookingStatus: true,
        bookingOrder: {
          select: {
            bookingStatus: true
          }
        }
      }
    });

    const expiredOrderIds = [...new Set(expiredHolds.map((item) => item.bookingOrderId))];

    for (const bookingOrderId of expiredOrderIds) {
      const order = expiredHolds.find((item) => item.bookingOrderId === bookingOrderId)?.bookingOrder;
      const updatedOrder = await tx.bookingOrder.updateMany({
        where: {
          bookingOrderId,
          bookingStatus: BookingStatus.PENDING_PAYMENT
        },
        data: {
          bookingStatus: BookingStatus.PAYMENT_EXPIRED,
          paymentStatus: PaymentStatus.EXPIRED,
          refundable: false
        }
      });

      if (updatedOrder.count > 0) {
        await this.recordOrderStatusHistory(tx, {
          bookingOrderId,
          oldStatus: order?.bookingStatus ?? BookingStatus.PENDING_PAYMENT,
          newStatus: BookingStatus.PAYMENT_EXPIRED,
          actionType: "AUTO_EXPIRE_PAYMENT_HOLD",
          note: "Expired pending-payment hold before creating a new booking hold"
        });
      }
    }

    for (const item of expiredHolds) {
      const updatedItem = await tx.bookingItem.updateMany({
        where: {
          bookingItemId: item.bookingItemId,
          bookingStatus: BookingStatus.PENDING_PAYMENT
        },
        data: {
          bookingStatus: BookingStatus.PAYMENT_EXPIRED
        }
      });

      if (updatedItem.count === 0) {
        continue;
      }

      await this.recordItemStatusHistory(tx, {
        bookingItemId: item.bookingItemId,
        oldStatus: item.bookingStatus,
        newStatus: BookingStatus.PAYMENT_EXPIRED,
        actionType: "AUTO_EXPIRE_PAYMENT_HOLD",
        note: "Expired pending-payment hold before creating a new booking hold"
      });
    }
  }
}

export const bookingStateService = new BookingStateService();

