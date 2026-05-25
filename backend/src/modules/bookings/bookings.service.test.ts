import {
  AccountStatus,
  BookingPermissionStatus,
  BookingStatus,
  CourtStatus,
  EntityStatus,
  PaymentStatus,
  Prisma,
  type PrismaClient
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { RefundsService } from "../refunds/refunds.service";
import { RulesRepository } from "../rules/rules.repository";
import { BookingsService } from "./bookings.service";

const userId = "00000000-0000-4000-8000-000000000801";
const courtId = "00000000-0000-4000-8000-000000000802";
const secondCourtId = "00000000-0000-4000-8000-000000000812";
const courtTypeId = "00000000-0000-4000-8000-000000000803";
const bookingOrderId = "00000000-0000-4000-8000-000000000804";
const bookingItemId = "00000000-0000-4000-8000-000000000814";
const secondBookingItemId = "00000000-0000-4000-8000-000000000815";
const paymentId = "00000000-0000-4000-8000-000000000805";
const refundId = "00000000-0000-4000-8000-000000000806";
const priorityGroupId = "00000000-0000-4000-8000-000000000807";
const now = new Date("2026-05-20T00:00:00.000Z");

function bookingRule() {
  return {
    bookingRuleId: "00000000-0000-4000-8000-000000000808",
    ruleName: "DEFAULT",
    holdMinutes: 10,
    cancelBeforeHours: 2,
    lateCheckinMinutes: 15,
    maxBookingsPerDay: 2,
    maxDurationMinutes: 120,
    violationThreshold: 3,
    bookingBanDays: 7,
    refundRateUserOnTime: 80,
    refundRateManagerFault: 100,
    status: EntityStatus.ACTIVE,
    updatedByUserId: null,
    createdAt: now,
    updatedAt: now
  };
}

function effectivePolicy() {
  return {
    holdMinutes: 10,
    cancelBeforeHours: 2,
    lateCheckinMinutes: 15,
    maxDurationMinutes: 120,
    maxBookingsPerDay: 2,
    advanceBookingDays: 7,
    canJoinWaitlist: true,
    refundRateUserOnTime: 80,
    refundRateManagerFault: 100
  };
}

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    userId,
    priorityGroupId,
    fullName: "Sample User",
    email: "user@example.edu",
    phoneNumber: null,
    passwordHash: "hash",
    identityCode: "STUDENT001",
    accountStatus: AccountStatus.ACTIVE,
    bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
    bookingLockedUntil: null,
    violationPoints: 0,
    reputationPoints: 100,
    createdAt: now,
    updatedAt: now,
    priorityGroup: {
      priorityGroupId,
      groupCode: "STUDENT",
      groupName: "Student",
      priorityLevel: 2,
      advanceBookingDays: 7,
      description: null,
      status: EntityStatus.ACTIVE,
      createdAt: now,
      updatedAt: now
    },
    ...overrides
  };
}

function buildCourt(id = courtId, overrides: Record<string, unknown> = {}) {
  return {
    courtId: id,
    courtTypeId,
    courtName: id === courtId ? "Main Field" : "Side Field",
    description: null,
    imageUrl: null,
    status: CourtStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    courtType: {
      courtTypeId,
      typeName: "Football",
      description: null,
      status: EntityStatus.ACTIVE,
      createdAt: now,
      updatedAt: now
    },
    operatingHours: [
      {
        operatingHourId: "00000000-0000-4000-8000-000000000809",
        courtId: id,
        weekday: 4,
        openTime: "08:00",
        closeTime: "12:00",
        slotDurationMinutes: 60,
        status: EntityStatus.ACTIVE,
        createdAt: now,
        updatedAt: now
      }
    ],
    pricingRules: [
      {
        pricingRuleId: "00000000-0000-4000-8000-000000000810",
        courtId: id,
        createdByUserId: null,
        priorityGroupId: null,
        startTime: "08:00",
        endTime: "12:00",
        applicableDay: null,
        priceAmount: new Prisma.Decimal(50000),
        effectiveFrom: null,
        effectiveTo: null,
        status: EntityStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        priorityGroup: null
      }
    ],
    ...overrides
  };
}

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    bookingOrderId,
    bookingCode: "BK-20260520-TEST01",
    userId,
    totalAmount: new Prisma.Decimal(50000),
    bookingStatus: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.INITIATED,
    refundable: true,
    holdExpiresAt: new Date("2026-05-20T00:10:00.000Z"),
    note: null,
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    user: {
      userId,
      fullName: "Sample User",
      email: "user@example.edu"
    },
    items: [
      {
        bookingItemId,
        bookingOrderId,
        courtId,
        startDatetime: new Date("2026-05-21T08:00:00.000Z"),
        endDatetime: new Date("2026-05-21T09:00:00.000Z"),
        unitPrice: new Prisma.Decimal(50000),
        amount: new Prisma.Decimal(50000),
        bookingStatus: BookingStatus.PENDING_PAYMENT,
        checkinTime: null,
        checkedInByUserId: null,
        completedByUserId: null,
        noShowMarkedByUserId: null,
        managerNote: null,
        createdAt: now,
        updatedAt: now,
        court: buildCourt(),
        itemStatusHistories: []
      }
    ],
    orderStatusHistories: [],
    payments: [],
    refunds: [],
    ...overrides
  };
}

function createTx(input: {
  courts?: Record<string, unknown>;
  existingOrderCount?: number;
  overlappingItems?: unknown[];
  createdItemIds?: string[];
  createdOrder?: unknown;
}) {
  const createdItemIds = input.createdItemIds ?? [bookingItemId];
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue(buildUser())
    },
    bookingRule: {
      findFirst: vi.fn().mockResolvedValue(bookingRule())
    },
    priorityPolicy: {
      findFirst: vi.fn().mockResolvedValue(null)
    },
    court: {
      findUnique: vi.fn(async ({ where }: { where: { courtId: string } }) => {
        if (input.courts?.[where.courtId]) {
          return input.courts[where.courtId];
        }

        return buildCourt(where.courtId);
      })
    },
    bookingOrder: {
      count: vi.fn().mockResolvedValue(input.existingOrderCount ?? 0),
      create: vi.fn().mockResolvedValue({ bookingOrderId }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(input.createdOrder ?? buildOrder())
    },
    bookingItem: {
      findMany: vi.fn(async (args: { select?: Record<string, unknown>; where?: Record<string, unknown> }) => {
        if (args.where?.bookingOrderId === bookingOrderId && args.select?.bookingItemId && !args.select?.bookingOrderId) {
          return createdItemIds.map((id) => ({ bookingItemId: id }));
        }

        if (args.select?.startDatetime) {
          return input.overlappingItems ?? [];
        }

        return [];
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 })
    },
    bookingOrderStatusHistory: {
      create: vi.fn().mockResolvedValue({})
    },
    bookingItemStatusHistory: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  return tx;
}

function createService(
  tx: unknown,
  overrides: { rules?: RulesRepository; refunds?: RefundsService } = {}
) {
  return new BookingsService(
    {
      $transaction: vi.fn((callback) => callback(tx))
    } as unknown as PrismaClient,
    undefined,
    undefined,
    overrides.rules,
    overrides.refunds,
    () => now,
    () => "BK-20260520-TEST01"
  );
}

describe("BookingsService", () => {
  it("creates a single booking order with one item and writes histories", async () => {
    const tx = createTx({});
    const service = createService(tx);

    const order = await service.createBookingHold(userId, {
      items: [
        {
          courtId,
          startDatetime: new Date("2026-05-21T08:00:00.000Z"),
          endDatetime: new Date("2026-05-21T09:00:00.000Z")
        }
      ],
      note: "Class training"
    });

    expect(order).toMatchObject({
      id: bookingOrderId,
      bookingCode: "BK-20260520-TEST01",
      bookingStatus: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.INITIATED,
      totalAmount: 50000,
      items: [{ bookingItemId }]
    });
    expect(tx.bookingOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: new Prisma.Decimal(50000),
          items: {
            create: [
              expect.objectContaining({
                courtId,
                amount: new Prisma.Decimal(50000),
                bookingStatus: BookingStatus.PENDING_PAYMENT
              })
            ]
          }
        })
      })
    );
    expect(tx.bookingOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingOrderId,
          oldStatus: null,
          newStatus: BookingStatus.PENDING_PAYMENT,
          actionType: "USER_CREATE_BOOKING_ORDER_HOLD"
        })
      })
    );
    expect(tx.bookingItemStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingItemId,
          oldStatus: null,
          newStatus: BookingStatus.PENDING_PAYMENT,
          actionType: "USER_CREATE_BOOKING_ITEM_HOLD"
        })
      })
    );
  });

  it("creates a combo booking order with multiple items", async () => {
    const comboOrder = buildOrder({
      totalAmount: new Prisma.Decimal(100000),
      items: [
        buildOrder().items[0],
        {
          ...buildOrder().items[0],
          bookingItemId: secondBookingItemId,
          courtId: secondCourtId,
          amount: new Prisma.Decimal(50000),
          court: buildCourt(secondCourtId)
        }
      ]
    });
    const tx = createTx({
      createdItemIds: [bookingItemId, secondBookingItemId],
      createdOrder: comboOrder
    });
    const service = createService(tx);

    const order = await service.createBookingHold(userId, {
      items: [
        {
          courtId,
          startDatetime: new Date("2026-05-21T08:00:00.000Z"),
          endDatetime: new Date("2026-05-21T09:00:00.000Z")
        },
        {
          courtId: secondCourtId,
          startDatetime: new Date("2026-05-21T09:00:00.000Z"),
          endDatetime: new Date("2026-05-21T10:00:00.000Z")
        }
      ]
    });

    expect(order.totalAmount).toBe(100000);
    expect(order.items).toHaveLength(2);
    expect(tx.bookingOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: new Prisma.Decimal(100000),
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({ courtId }),
              expect.objectContaining({ courtId: secondCourtId })
            ])
          }
        })
      })
    );
  });

  it("does not create an order when one combo item conflicts", async () => {
    const tx = createTx({
      overlappingItems: [
        {
          bookingItemId: "00000000-0000-4000-8000-000000000899",
          bookingOrderId: "00000000-0000-4000-8000-000000000898",
          bookingStatus: BookingStatus.CONFIRMED,
          startDatetime: new Date("2026-05-21T09:30:00.000Z"),
          endDatetime: new Date("2026-05-21T10:30:00.000Z"),
          bookingOrder: {
            holdExpiresAt: null
          }
        }
      ]
    });
    const service = createService(tx);

    await expect(
      service.createBookingHold(userId, {
        items: [
          {
            courtId,
            startDatetime: new Date("2026-05-21T08:00:00.000Z"),
            endDatetime: new Date("2026-05-21T09:00:00.000Z")
          },
          {
            courtId: secondCourtId,
            startDatetime: new Date("2026-05-21T09:00:00.000Z"),
            endDatetime: new Date("2026-05-21T10:00:00.000Z")
          }
        ]
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BOOKING_SLOT_UNAVAILABLE"
    });
    expect(tx.bookingOrder.create).not.toHaveBeenCalled();
  });

  it("cancels a confirmed booking order and requests refund by bookingOrderId", async () => {
    const payment = {
      paymentId,
      bookingOrderId,
      userId,
      amount: new Prisma.Decimal(100000),
      paymentMethod: "MOCK",
      gatewayTransactionId: "gw_1",
      paymentStatus: PaymentStatus.SUCCESS,
      rawCallback: null,
      paidAt: new Date("2026-05-20T01:00:00.000Z"),
      createdAt: now,
      updatedAt: now
    };
    const currentOrder = buildOrder({
      bookingStatus: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.SUCCESS,
      user: buildUser(),
      payments: [payment],
      items: [
        {
          ...buildOrder().items[0],
          bookingStatus: BookingStatus.CONFIRMED
        }
      ]
    });
    const cancelledOrder = buildOrder({
      bookingStatus: BookingStatus.CANCELLED_BY_USER,
      paymentStatus: PaymentStatus.SUCCESS,
      refundable: true,
      cancelledByUserId: userId,
      cancelledAt: now,
      payments: [payment],
      refunds: [
        {
          refundId,
          paymentId,
          bookingOrderId,
          bookingItemId: null,
          refundAmount: new Prisma.Decimal(80000),
          refundReason: "Schedule changed",
          refundStatus: "REQUESTED",
          requestedByUserId: userId,
          processedByUserId: null,
          gatewayRefundId: null,
          requestedAt: now,
          processedAt: null,
          updatedAt: now
        }
      ]
    });
    const tx = {
      bookingOrder: {
        findFirst: vi.fn().mockResolvedValue(currentOrder),
        update: vi.fn().mockResolvedValue({ bookingOrderId }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(cancelledOrder)
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
    const rules = {
      getEffectivePolicy: vi.fn().mockResolvedValue(effectivePolicy())
    } as unknown as RulesRepository;
    const refunds = {
      createRefundForBooking: vi.fn().mockResolvedValue({ refundId, created: true })
    } as unknown as RefundsService;
    const service = createService(tx, { rules, refunds });

    const order = await service.cancelMyBooking(userId, bookingOrderId, {
      reason: "Schedule changed"
    });

    expect(order).toMatchObject({
      id: bookingOrderId,
      bookingStatus: BookingStatus.CANCELLED_BY_USER,
      refundable: true
    });
    expect(refunds.createRefundForBooking).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        bookingOrderId,
        bookingStatus: BookingStatus.CONFIRMED,
        payment,
        refundRate: 80,
        refundReason: "Schedule changed",
        requestedByUserId: userId
      })
    );
  });

  it("rejects confirmed user cancellation after the configured cancel window", async () => {
    const tx = {
      bookingOrder: {
        findFirst: vi.fn().mockResolvedValue(
          buildOrder({
            bookingStatus: BookingStatus.CONFIRMED,
            paymentStatus: PaymentStatus.SUCCESS,
            user: buildUser(),
            items: [
              {
                ...buildOrder().items[0],
                startDatetime: new Date("2026-05-20T01:00:00.000Z"),
                bookingStatus: BookingStatus.CONFIRMED
              }
            ],
            payments: [
              {
                paymentId,
                bookingOrderId,
                userId,
                amount: new Prisma.Decimal(100000),
                paymentMethod: "MOCK",
                gatewayTransactionId: "gw_1",
                paymentStatus: PaymentStatus.SUCCESS,
                rawCallback: null,
                paidAt: new Date("2026-05-20T01:00:00.000Z"),
                createdAt: now,
                updatedAt: now
              }
            ]
          })
        ),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn()
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
    const rules = {
      getEffectivePolicy: vi.fn().mockResolvedValue(effectivePolicy())
    } as unknown as RulesRepository;
    const refunds = {
      createRefundForBooking: vi.fn()
    } as unknown as RefundsService;
    const service = createService(tx, { rules, refunds });

    await expect(
      service.cancelMyBooking(userId, bookingOrderId, {
        reason: "Too late"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BOOKING_CANCEL_WINDOW_CLOSED"
    });
    expect(refunds.createRefundForBooking).not.toHaveBeenCalled();
    expect(tx.bookingOrder.update).not.toHaveBeenCalled();
  });
});
