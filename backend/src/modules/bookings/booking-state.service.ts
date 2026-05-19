import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";

export class BookingStateService {
  async recordStatusHistory(
    tx: Prisma.TransactionClient,
    input: {
      bookingId: string;
      oldStatus?: BookingStatus | null;
      newStatus: BookingStatus;
      actionType: string;
      actionByUserId?: string | null;
      note?: string | null;
    }
  ): Promise<void> {
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: input.bookingId,
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
    const expiredHolds = await tx.booking.findMany({
      where: {
        courtId: input.courtId,
        bookingStatus: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: {
          lte: input.now
        },
        startDatetime: {
          lt: input.endDatetime
        },
        endDatetime: {
          gt: input.startDatetime
        }
      },
      select: {
        bookingId: true,
        bookingStatus: true
      }
    });

    for (const booking of expiredHolds) {
      const updated = await tx.booking.updateMany({
        where: {
          bookingId: booking.bookingId,
          bookingStatus: BookingStatus.PENDING_PAYMENT
        },
        data: {
          bookingStatus: BookingStatus.PAYMENT_EXPIRED,
          paymentStatus: PaymentStatus.EXPIRED,
          refundable: false,
          noRefundReason: "Payment hold expired"
        }
      });

      if (updated.count === 0) {
        continue;
      }

      await this.recordStatusHistory(tx, {
        bookingId: booking.bookingId,
        oldStatus: booking.bookingStatus,
        newStatus: BookingStatus.PAYMENT_EXPIRED,
        actionType: "AUTO_EXPIRE_PAYMENT_HOLD",
        note: "Expired pending-payment hold before creating a new booking hold"
      });
    }
  }
}

export const bookingStateService = new BookingStateService();

