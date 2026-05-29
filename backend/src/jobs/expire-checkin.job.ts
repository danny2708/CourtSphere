import {
  BookingStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";

import { prisma } from "../config/prisma";
import { bookingStateService, type BookingStateService } from "../modules/bookings/booking-state.service";
import {
  notificationsService,
  type NotificationsService
} from "../modules/notifications/notifications.service";
import { RulesRepository, rulesRepository } from "../modules/rules/rules.repository";
import { recomputeBookingOrderStatus } from "./booking-order-aggregate";
import type { JobRunOptions, JobRunResult } from "./jobs.types";

const jobName = "expire-checkin";

const checkinExpiryItemInclude = {
  bookingOrder: {
    select: {
      bookingOrderId: true,
      bookingCode: true,
      userId: true,
      paymentStatus: true
    }
  }
} satisfies Prisma.BookingItemInclude;

type CheckinExpiryItem = Prisma.BookingItemGetPayload<{
  include: typeof checkinExpiryItemInclude;
}>;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export class ExpireCheckinJob {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly state: BookingStateService = bookingStateService,
    private readonly rules: RulesRepository = rulesRepository,
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly notifications: NotificationsService = notificationsService
  ) {}

  async run(options: JobRunOptions = {}): Promise<JobRunResult> {
    const now = this.nowProvider();
    const bookingRule = await this.rules.getBookingRuleForPolicy();
    const cutoff = addMinutes(now, -bookingRule.lateCheckinMinutes);
    const batchSize = options.batchSize ?? 100;
    const items = await this.db.bookingItem.findMany({
      where: this.expirableItemWhere(cutoff),
      include: checkinExpiryItemInclude,
      orderBy: [{ startDatetime: "asc" }],
      take: batchSize
    });
    let processed = 0;

    for (const item of items) {
      const expired = await this.db.$transaction(
        async (tx) => this.expireItemIfStillEligible(tx, item, cutoff),
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

  private expirableItemWhere(cutoff: Date): Prisma.BookingItemWhereInput {
    return {
      bookingStatus: BookingStatus.CONFIRMED,
      checkinTime: null,
      startDatetime: {
        lt: cutoff
      },
      bookingOrder: {
        paymentStatus: PaymentStatus.SUCCESS
      }
    };
  }

  private async expireItemIfStillEligible(
    tx: Prisma.TransactionClient,
    item: CheckinExpiryItem,
    cutoff: Date
  ): Promise<boolean> {
    const currentItem = await tx.bookingItem.findFirst({
      where: {
        bookingItemId: item.bookingItemId,
        ...this.expirableItemWhere(cutoff)
      },
      include: checkinExpiryItemInclude
    });

    if (!currentItem) {
      return false;
    }

    const updatedItem = await tx.bookingItem.updateMany({
      where: {
        bookingItemId: currentItem.bookingItemId,
        ...this.expirableItemWhere(cutoff)
      },
      data: {
        bookingStatus: BookingStatus.CHECKIN_EXPIRED
      }
    });

    if (updatedItem.count === 0) {
      return false;
    }

    await this.state.recordItemStatusHistory(tx, {
      bookingItemId: currentItem.bookingItemId,
      oldStatus: currentItem.bookingStatus,
      newStatus: BookingStatus.CHECKIN_EXPIRED,
      actionType: "AUTO_EXPIRE_CHECKIN",
      note: "System marked booking item as check-in expired"
    });
    await recomputeBookingOrderStatus(tx, {
      bookingOrderId: currentItem.bookingOrderId,
      state: this.state
    });
    await this.notifications.createBookingNotification(tx, {
      userId: currentItem.bookingOrder.userId,
      bookingOrderId: currentItem.bookingOrderId,
      bookingItemId: currentItem.bookingItemId,
      notificationType: NotificationType.CHECKIN_EXPIRED,
      title: "Check-in window expired",
      content: `Booking ${currentItem.bookingOrder.bookingCode} check-in window has expired.`
    });

    return true;
  }
}

export const expireCheckinJob = new ExpireCheckinJob();
