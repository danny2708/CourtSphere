import { BookingStatus, PaymentStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../config/prisma";
import { bookingStateService, type BookingStateService } from "../modules/bookings/booking-state.service";
import type { JobRunOptions, JobRunResult } from "./jobs.types";

const jobName = "expire-payment-holds";
const expirableOrderStatuses: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING
];
const expirableItemStatuses: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING
];
const expirablePaymentStatuses: PaymentStatus[] = [
  PaymentStatus.INITIATED,
  PaymentStatus.PROCESSING
];

const expirableOrderInclude = {
  items: {
    select: {
      bookingItemId: true,
      bookingStatus: true
    }
  },
  payments: {
    select: {
      paymentId: true,
      paymentStatus: true
    }
  }
} satisfies Prisma.BookingOrderInclude;

type ExpirableOrder = Prisma.BookingOrderGetPayload<{
  include: typeof expirableOrderInclude;
}>;

export class ExpirePaymentHoldsJob {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly state: BookingStateService = bookingStateService,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async run(options: JobRunOptions = {}): Promise<JobRunResult> {
    const now = this.nowProvider();
    const batchSize = options.batchSize ?? 100;
    const orders = await this.db.bookingOrder.findMany({
      where: this.expirableOrderWhere(now),
      include: expirableOrderInclude,
      orderBy: [{ holdExpiresAt: "asc" }],
      take: batchSize
    });
    let processed = 0;

    for (const order of orders) {
      const expired = await this.db.$transaction(
        async (tx) => this.expireOrderIfStillEligible(tx, order, now),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      if (expired) {
        processed += 1;
      }
    }

    return {
      jobName,
      processed
    };
  }

  private expirableOrderWhere(now: Date): Prisma.BookingOrderWhereInput {
    return {
      bookingStatus: {
        in: expirableOrderStatuses
      },
      holdExpiresAt: {
        lt: now
      },
      payments: {
        none: {
          paymentStatus: PaymentStatus.SUCCESS
        }
      }
    };
  }

  private async expireOrderIfStillEligible(
    tx: Prisma.TransactionClient,
    order: ExpirableOrder,
    now: Date
  ): Promise<boolean> {
    const currentOrder = await tx.bookingOrder.findFirst({
      where: {
        bookingOrderId: order.bookingOrderId,
        ...this.expirableOrderWhere(now)
      },
      include: expirableOrderInclude
    });

    if (!currentOrder) {
      return false;
    }

    const updatedOrder = await tx.bookingOrder.updateMany({
      where: {
        bookingOrderId: currentOrder.bookingOrderId,
        ...this.expirableOrderWhere(now)
      },
      data: {
        bookingStatus: BookingStatus.PAYMENT_EXPIRED,
        paymentStatus: PaymentStatus.EXPIRED,
        refundable: false
      }
    });

    if (updatedOrder.count === 0) {
      return false;
    }

    await tx.payment.updateMany({
      where: {
        bookingOrderId: currentOrder.bookingOrderId,
        paymentStatus: {
          in: expirablePaymentStatuses
        }
      },
      data: {
        paymentStatus: PaymentStatus.EXPIRED
      }
    });

    const itemsToExpire = currentOrder.items.filter((item) =>
      expirableItemStatuses.includes(item.bookingStatus)
    );
    await tx.bookingItem.updateMany({
      where: {
        bookingOrderId: currentOrder.bookingOrderId,
        bookingStatus: {
          in: expirableItemStatuses
        }
      },
      data: {
        bookingStatus: BookingStatus.PAYMENT_EXPIRED
      }
    });

    await this.state.recordOrderStatusHistory(tx, {
      bookingOrderId: currentOrder.bookingOrderId,
      oldStatus: currentOrder.bookingStatus,
      newStatus: BookingStatus.PAYMENT_EXPIRED,
      actionType: "AUTO_EXPIRE_PAYMENT_HOLD",
      note: "System expired booking order after payment hold elapsed"
    });

    for (const item of itemsToExpire) {
      await this.state.recordItemStatusHistory(tx, {
        bookingItemId: item.bookingItemId,
        oldStatus: item.bookingStatus,
        newStatus: BookingStatus.PAYMENT_EXPIRED,
        actionType: "AUTO_EXPIRE_PAYMENT_HOLD",
        note: "System expired booking item after payment hold elapsed"
      });
    }

    return true;
  }
}

export const expirePaymentHoldsJob = new ExpirePaymentHoldsJob();
