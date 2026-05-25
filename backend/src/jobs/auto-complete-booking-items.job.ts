import { BookingStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../config/prisma";
import { bookingStateService, type BookingStateService } from "../modules/bookings/booking-state.service";
import { recomputeBookingOrderStatus } from "./booking-order-aggregate";
import type { JobRunOptions, JobRunResult } from "./jobs.types";

const jobName = "auto-complete-booking-items";

export class AutoCompleteBookingItemsJob {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly state: BookingStateService = bookingStateService,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async run(options: JobRunOptions = {}): Promise<JobRunResult> {
    const now = this.nowProvider();
    const batchSize = options.batchSize ?? 100;
    const items = await this.db.bookingItem.findMany({
      where: this.completableItemWhere(now),
      select: {
        bookingItemId: true,
        bookingOrderId: true,
        bookingStatus: true
      },
      orderBy: [{ endDatetime: "asc" }],
      take: batchSize
    });
    let processed = 0;

    for (const item of items) {
      const completed = await this.db.$transaction(
        async (tx) => this.completeItemIfStillEligible(tx, item, now),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      if (completed) {
        processed += 1;
      }
    }

    return {
      jobName,
      processed
    };
  }

  private completableItemWhere(now: Date): Prisma.BookingItemWhereInput {
    return {
      bookingStatus: BookingStatus.IN_USE,
      endDatetime: {
        lte: now
      }
    };
  }

  private async completeItemIfStillEligible(
    tx: Prisma.TransactionClient,
    item: {
      bookingItemId: string;
      bookingOrderId: string;
      bookingStatus: BookingStatus;
    },
    now: Date
  ): Promise<boolean> {
    const currentItem = await tx.bookingItem.findFirst({
      where: {
        bookingItemId: item.bookingItemId,
        ...this.completableItemWhere(now)
      },
      select: {
        bookingItemId: true,
        bookingOrderId: true,
        bookingStatus: true
      }
    });

    if (!currentItem) {
      return false;
    }

    const updatedItem = await tx.bookingItem.updateMany({
      where: {
        bookingItemId: currentItem.bookingItemId,
        ...this.completableItemWhere(now)
      },
      data: {
        bookingStatus: BookingStatus.COMPLETED,
        completedByUserId: null
      }
    });

    if (updatedItem.count === 0) {
      return false;
    }

    await this.state.recordItemStatusHistory(tx, {
      bookingItemId: currentItem.bookingItemId,
      oldStatus: currentItem.bookingStatus,
      newStatus: BookingStatus.COMPLETED,
      actionType: "AUTO_COMPLETE_BOOKING_ITEM",
      note: "System completed booking item after end time"
    });
    await recomputeBookingOrderStatus(tx, {
      bookingOrderId: currentItem.bookingOrderId,
      state: this.state
    });

    return true;
  }
}

export const autoCompleteBookingItemsJob = new AutoCompleteBookingItemsJob();
