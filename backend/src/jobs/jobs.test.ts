import {
  BookingStatus,
  NotificationType,
  PaymentStatus,
  WaitlistStatus,
  type PrismaClient
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AutoCompleteBookingItemsJob } from "./auto-complete-booking-items.job";
import { ExpireCheckinJob } from "./expire-checkin.job";
import { ExpirePaymentHoldsJob } from "./expire-payment-holds.job";
import { ExpireWaitlistNotificationsJob } from "./expire-waitlist-notifications.job";
import { JobsRunner } from "./jobs.runner";

const bookingOrderId = "00000000-0000-4000-8000-000000001701";
const bookingItemId = "00000000-0000-4000-8000-000000001702";
const paymentId = "00000000-0000-4000-8000-000000001704";
const userId = "00000000-0000-4000-8000-000000001705";
const waitlistEntryId = "00000000-0000-4000-8000-000000001706";
const now = new Date("2026-05-20T10:00:00.000Z");

function createTransactionDb(tx: unknown, models: Record<string, unknown> = {}) {
  return {
    $transaction: vi.fn((callback) => callback(tx)),
    ...models
  } as unknown as PrismaClient;
}

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    bookingOrderId,
    bookingStatus: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.INITIATED,
    holdExpiresAt: new Date("2026-05-20T09:45:00.000Z"),
    items: [
      {
        bookingItemId,
        bookingStatus: BookingStatus.PENDING_PAYMENT
      }
    ],
    payments: [
      {
        paymentId,
        paymentStatus: PaymentStatus.PROCESSING
      }
    ],
    ...overrides
  };
}

function buildBookingItem(overrides: Record<string, unknown> = {}) {
  return {
    bookingItemId,
    bookingOrderId,
    bookingStatus: BookingStatus.CONFIRMED,
    startDatetime: new Date("2026-05-20T09:40:00.000Z"),
    endDatetime: new Date("2026-05-20T10:30:00.000Z"),
    checkinTime: null,
    bookingOrder: {
      bookingOrderId,
      paymentStatus: PaymentStatus.SUCCESS
    },
    ...overrides
  };
}

function buildWaitlistEntry(overrides: Record<string, unknown> = {}) {
  return {
    waitlistEntryId,
    userId,
    status: WaitlistStatus.NOTIFIED,
    expiresAt: new Date("2026-05-20T09:55:00.000Z"),
    ...overrides
  };
}

function bookingRule(lateCheckinMinutes = 15) {
  return {
    holdMinutes: 10,
    cancelBeforeHours: 2,
    lateCheckinMinutes,
    maxBookingsPerDay: 2,
    maxDurationMinutes: 120,
    violationThreshold: 3,
    bookingBanDays: 7,
    refundRateUserOnTime: 100,
    refundRateManagerFault: 100
  };
}

describe("system jobs", () => {
  it("expires pending-payment booking orders, items, and processing payments", async () => {
    const order = buildOrder();
    const tx = {
      bookingOrder: {
        findFirst: vi.fn().mockResolvedValue(order),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingOrderStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      bookingItemStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const db = createTransactionDb(tx, {
      bookingOrder: {
        findMany: vi.fn().mockResolvedValue([order])
      }
    });
    const job = new ExpirePaymentHoldsJob(db, undefined, () => now);

    const result = await job.run();

    expect(result).toEqual({
      jobName: "expire-payment-holds",
      processed: 1
    });
    expect(tx.bookingOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.PAYMENT_EXPIRED,
          paymentStatus: PaymentStatus.EXPIRED,
          refundable: false
        })
      })
    );
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          paymentStatus: PaymentStatus.EXPIRED
        }
      })
    );
    expect(tx.bookingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bookingStatus: BookingStatus.PAYMENT_EXPIRED
        }
      })
    );
    expect(tx.bookingOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.PENDING_PAYMENT,
          newStatus: BookingStatus.PAYMENT_EXPIRED,
          actionType: "AUTO_EXPIRE_PAYMENT_HOLD"
        })
      })
    );
    expect(tx.bookingItemStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.PENDING_PAYMENT,
          newStatus: BookingStatus.PAYMENT_EXPIRED
        })
      })
    );
  });

  it("does not expire orders that already have successful payment", async () => {
    const db = createTransactionDb({}, {
      bookingOrder: {
        findMany: vi.fn().mockResolvedValue([])
      }
    });
    const job = new ExpirePaymentHoldsJob(db, undefined, () => now);

    const result = await job.run();

    expect(result.processed).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not write duplicate payment-expiry history when a stale record is reprocessed", async () => {
    const order = buildOrder();
    const tx = {
      bookingOrder: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn()
      },
      payment: {
        updateMany: vi.fn()
      },
      bookingItem: {
        updateMany: vi.fn()
      },
      bookingOrderStatusHistory: {
        create: vi.fn()
      },
      bookingItemStatusHistory: {
        create: vi.fn()
      }
    };
    const db = createTransactionDb(tx, {
      bookingOrder: {
        findMany: vi.fn().mockResolvedValue([order])
      }
    });
    const job = new ExpirePaymentHoldsJob(db, undefined, () => now);

    const result = await job.run();

    expect(result.processed).toBe(0);
    expect(tx.bookingOrderStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.bookingItemStatusHistory.create).not.toHaveBeenCalled();
  });

  it("expires overdue confirmed booking items into CHECKIN_EXPIRED", async () => {
    const item = buildBookingItem();
    const tx = {
      bookingItem: {
        findFirst: vi.fn().mockResolvedValue(item),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingOrder: {
        findUnique: vi.fn().mockResolvedValue({
          bookingOrderId,
          bookingStatus: BookingStatus.CONFIRMED,
          items: [{ bookingStatus: BookingStatus.CHECKIN_EXPIRED }]
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingItemStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      bookingOrderStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      refund: {
        create: vi.fn()
      }
    };
    const db = createTransactionDb(tx, {
      bookingItem: {
        findMany: vi.fn().mockResolvedValue([item])
      }
    });
    const rules = {
      getBookingRuleForPolicy: vi.fn().mockResolvedValue(bookingRule())
    };
    const job = new ExpireCheckinJob(db, undefined, rules as never, () => now);

    const result = await job.run();

    expect(result).toEqual({
      jobName: "expire-checkin",
      processed: 1
    });
    expect(tx.bookingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bookingStatus: BookingStatus.CHECKIN_EXPIRED
        }
      })
    );
    expect(tx.bookingItemStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.CONFIRMED,
          newStatus: BookingStatus.CHECKIN_EXPIRED,
          actionType: "AUTO_EXPIRE_CHECKIN"
        })
      })
    );
    expect(tx.bookingOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bookingStatus: BookingStatus.CHECKIN_EXPIRED
        }
      })
    );
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it("does not expire IN_USE or not-yet-late check-in items", async () => {
    const db = createTransactionDb({}, {
      bookingItem: {
        findMany: vi.fn().mockResolvedValue([])
      }
    });
    const rules = {
      getBookingRuleForPolicy: vi.fn().mockResolvedValue(bookingRule())
    };
    const job = new ExpireCheckinJob(db, undefined, rules as never, () => now);

    const result = await job.run();

    expect(result.processed).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("auto-completes IN_USE items after end time and completes order when all items completed", async () => {
    const item = buildBookingItem({
      bookingStatus: BookingStatus.IN_USE,
      endDatetime: new Date("2026-05-20T09:50:00.000Z")
    });
    const tx = {
      bookingItem: {
        findFirst: vi.fn().mockResolvedValue(item),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingOrder: {
        findUnique: vi.fn().mockResolvedValue({
          bookingOrderId,
          bookingStatus: BookingStatus.IN_USE,
          items: [{ bookingStatus: BookingStatus.COMPLETED }]
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingItemStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      bookingOrderStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const db = createTransactionDb(tx, {
      bookingItem: {
        findMany: vi.fn().mockResolvedValue([item])
      }
    });
    const job = new AutoCompleteBookingItemsJob(db, undefined, () => now);

    const result = await job.run();

    expect(result).toEqual({
      jobName: "auto-complete-booking-items",
      processed: 1
    });
    expect(tx.bookingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bookingStatus: BookingStatus.COMPLETED,
          completedByUserId: null
        }
      })
    );
    expect(tx.bookingItemStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.IN_USE,
          newStatus: BookingStatus.COMPLETED,
          actionType: "AUTO_COMPLETE_BOOKING_ITEM"
        })
      })
    );
    expect(tx.bookingOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bookingStatus: BookingStatus.COMPLETED
        }
      })
    );
    expect(tx.bookingOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.IN_USE,
          newStatus: BookingStatus.COMPLETED,
          actionType: "ALL_BOOKING_ITEMS_COMPLETED"
        })
      })
    );
  });

  it("does not complete order while another booking item is still active", async () => {
    const item = buildBookingItem({
      bookingStatus: BookingStatus.IN_USE,
      endDatetime: new Date("2026-05-20T09:50:00.000Z")
    });
    const tx = {
      bookingItem: {
        findFirst: vi.fn().mockResolvedValue(item),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingOrder: {
        findUnique: vi.fn().mockResolvedValue({
          bookingOrderId,
          bookingStatus: BookingStatus.IN_USE,
          items: [
            { bookingStatus: BookingStatus.COMPLETED },
            { bookingStatus: BookingStatus.CONFIRMED }
          ]
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingItemStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      bookingOrderStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const db = createTransactionDb(tx, {
      bookingItem: {
        findMany: vi.fn().mockResolvedValue([item])
      }
    });
    const job = new AutoCompleteBookingItemsJob(db, undefined, () => now);

    const result = await job.run();

    expect(result.processed).toBe(1);
    expect(tx.bookingOrder.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingOrderStatusHistory.create).not.toHaveBeenCalled();
  });

  it("expires notified waitlist entries and creates one basic notification", async () => {
    const entry = buildWaitlistEntry();
    const tx = {
      waitlistEntry: {
        findFirst: vi.fn().mockResolvedValue(entry),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      notification: {
        create: vi.fn().mockResolvedValue({})
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const db = createTransactionDb(tx, {
      waitlistEntry: {
        findMany: vi.fn().mockResolvedValue([entry])
      }
    });
    const job = new ExpireWaitlistNotificationsJob(db, () => now);

    const result = await job.run();

    expect(result).toEqual({
      jobName: "expire-waitlist-notifications",
      processed: 1
    });
    expect(tx.waitlistEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: WaitlistStatus.EXPIRED
        }
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          notificationType: NotificationType.SYSTEM
        })
      })
    );
  });

  it("does not expire WAITING waitlist entries or duplicate waitlist notifications", async () => {
    const staleEntry = buildWaitlistEntry();
    const tx = {
      waitlistEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn()
      },
      notification: {
        create: vi.fn()
      },
      auditLog: {
        create: vi.fn()
      }
    };
    const db = createTransactionDb(tx, {
      waitlistEntry: {
        findMany: vi.fn().mockResolvedValue([staleEntry])
      }
    });
    const job = new ExpireWaitlistNotificationsJob(db, () => now);

    const result = await job.run();

    expect(result.processed).toBe(0);
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("runs all system jobs once", async () => {
    const jobs = [
      { run: vi.fn().mockResolvedValue({ jobName: "a", processed: 1 }) },
      { run: vi.fn().mockResolvedValue({ jobName: "b", processed: 2 }) }
    ];
    const runner = new JobsRunner(jobs);

    const result = await runner.runOnce({ batchSize: 10 });

    expect(result).toEqual({
      results: [
        { jobName: "a", processed: 1 },
        { jobName: "b", processed: 2 }
      ],
      processed: 3
    });
    expect(jobs[0].run).toHaveBeenCalledWith({ batchSize: 10 });
    expect(jobs[1].run).toHaveBeenCalledWith({ batchSize: 10 });
  });
});
