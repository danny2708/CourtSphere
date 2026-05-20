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
const courtTypeId = "00000000-0000-4000-8000-000000000803";
const bookingId = "00000000-0000-4000-8000-000000000804";
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

function buildCourt(overrides: Record<string, unknown> = {}) {
  return {
    courtId,
    courtTypeId,
    courtName: "Main Field",
    location: "North Campus",
    capacity: 20,
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
        courtId,
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
        courtId,
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

function buildBooking(overrides: Record<string, unknown> = {}) {
  return {
    bookingId,
    bookingCode: "BK-20260520-TEST01",
    userId,
    courtId,
    startDatetime: new Date("2026-05-21T08:00:00.000Z"),
    endDatetime: new Date("2026-05-21T09:00:00.000Z"),
    participantCount: 10,
    usagePurpose: "Class training",
    totalAmount: new Prisma.Decimal(50000),
    bookingStatus: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.INITIATED,
    refundable: true,
    holdExpiresAt: new Date("2026-05-20T00:10:00.000Z"),
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    checkedInByUserId: null,
    completedByUserId: null,
    noShowMarkedByUserId: null,
    managerNote: null,
    noRefundReason: null,
    checkinTime: null,
    checkoutTime: null,
    createdAt: now,
    updatedAt: now,
    user: {
      userId,
      fullName: "Sample User",
      email: "user@example.edu"
    },
    court: buildCourt(),
    bookingStatusHistories: [],
    payments: [],
    refunds: [],
    ...overrides
  };
}

function createTx(input: {
  user?: unknown;
  court?: unknown;
  existingBookingCount?: number;
  overlappingBookings?: unknown[];
  createdBooking?: unknown;
}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(input.user ?? buildUser())
    },
    bookingRule: {
      findFirst: vi.fn().mockResolvedValue(bookingRule())
    },
    priorityPolicy: {
      findFirst: vi.fn().mockResolvedValue(null)
    },
    court: {
      findUnique: vi.fn().mockResolvedValue(input.court ?? buildCourt())
    },
    booking: {
      count: vi.fn().mockResolvedValue(input.existingBookingCount ?? 0),
      findMany: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(input.overlappingBookings ?? []),
      create: vi.fn().mockResolvedValue({ bookingId }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(input.createdBooking ?? buildBooking()),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    bookingStatusHistory: {
      create: vi.fn().mockResolvedValue({})
    },
    refund: {
      create: vi.fn()
    }
  };
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
  it("creates a pending-payment booking hold and writes status history", async () => {
    const tx = createTx({});
    const service = createService(tx);

    const booking = await service.createBookingHold(userId, {
      courtId,
      startDatetime: new Date("2026-05-21T08:00:00.000Z"),
      endDatetime: new Date("2026-05-21T09:00:00.000Z"),
      participantCount: 10,
      usagePurpose: "Class training"
    });

    expect(booking).toMatchObject({
      id: bookingId,
      bookingCode: "BK-20260520-TEST01",
      bookingStatus: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.INITIATED,
      totalAmount: 50000
    });
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.INITIATED,
          holdExpiresAt: new Date("2026-05-20T00:10:00.000Z"),
          totalAmount: new Prisma.Decimal(50000)
        })
      })
    );
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId,
          oldStatus: null,
          newStatus: BookingStatus.PENDING_PAYMENT,
          actionType: "USER_CREATE_BOOKING_HOLD",
          actionByUserId: userId
        })
      })
    );
  });

  it("rejects overlap with an active booking", async () => {
    const tx = createTx({
      overlappingBookings: [
        {
          bookingId: "00000000-0000-4000-8000-000000000811",
          bookingStatus: BookingStatus.CONFIRMED,
          startDatetime: new Date("2026-05-21T08:30:00.000Z"),
          endDatetime: new Date("2026-05-21T09:30:00.000Z"),
          holdExpiresAt: null
        }
      ]
    });
    const service = createService(tx);

    await expect(
      service.createBookingHold(userId, {
        courtId,
        startDatetime: new Date("2026-05-21T08:00:00.000Z"),
        endDatetime: new Date("2026-05-21T09:00:00.000Z"),
        participantCount: 10,
        usagePurpose: "Class training"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BOOKING_SLOT_UNAVAILABLE"
    });
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("rejects duration above configured maximum", async () => {
    const tx = createTx({});
    const service = createService(tx);

    await expect(
      service.createBookingHold(userId, {
        courtId,
        startDatetime: new Date("2026-05-21T08:00:00.000Z"),
        endDatetime: new Date("2026-05-21T11:00:00.000Z"),
        participantCount: 10,
        usagePurpose: "Class training"
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "BOOKING_DURATION_EXCEEDS_LIMIT"
    });
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("rejects daily quota overflow", async () => {
    const tx = createTx({ existingBookingCount: 2 });
    const service = createService(tx);

    await expect(
      service.createBookingHold(userId, {
        courtId,
        startDatetime: new Date("2026-05-21T08:00:00.000Z"),
        endDatetime: new Date("2026-05-21T09:00:00.000Z"),
        participantCount: 10,
        usagePurpose: "Class training"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "MAX_BOOKINGS_PER_DAY_REACHED"
    });
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it("cancels a pending-payment booking without creating a refund", async () => {
    const cancelledBooking = buildBooking({
      bookingStatus: BookingStatus.CANCELLED_BY_USER,
      paymentStatus: PaymentStatus.CANCELLED,
      refundable: false,
      noRefundReason: "Cancelled before payment success",
      cancelledByUserId: userId,
      cancelledAt: now
    });
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          ...buildBooking(),
          user: buildUser(),
          payments: []
        }),
        update: vi.fn().mockResolvedValue({ bookingId }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(cancelledBooking)
      },
      bookingStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      refund: {
        create: vi.fn()
      }
    };
    const rules = {
      getEffectivePolicy: vi.fn().mockResolvedValue({
        holdMinutes: 10,
        cancelBeforeHours: 2,
        lateCheckinMinutes: 15,
        maxDurationMinutes: 120,
        maxBookingsPerDay: 2,
        advanceBookingDays: 7,
        canJoinWaitlist: true,
        refundRateUserOnTime: 80,
        refundRateManagerFault: 100
      })
    } as unknown as RulesRepository;
    const service = createService(tx, { rules });

    const booking = await service.cancelMyBooking(userId, bookingId, {
      reason: "Schedule changed"
    });

    expect(booking).toMatchObject({
      id: bookingId,
      bookingStatus: BookingStatus.CANCELLED_BY_USER,
      paymentStatus: PaymentStatus.CANCELLED,
      refundable: false
    });
    expect(tx.refund.create).not.toHaveBeenCalled();
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.PENDING_PAYMENT,
          newStatus: BookingStatus.CANCELLED_BY_USER,
          actionType: "USER_CANCEL_BOOKING"
        })
      })
    );
  });

  it("cancels a confirmed booking and creates a requested refund when eligible", async () => {
    const payment = {
      paymentId,
      bookingId,
      userId,
      amount: new Prisma.Decimal(100000),
      paymentMethod: "FAKE",
      gatewayTransactionId: "gw_1",
      paymentStatus: PaymentStatus.SUCCESS,
      rawCallback: null,
      paidAt: new Date("2026-05-20T01:00:00.000Z"),
      createdAt: now,
      updatedAt: now
    };
    const cancelledBooking = buildBooking({
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
          bookingId,
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
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          ...buildBooking({
            bookingStatus: BookingStatus.CONFIRMED,
            paymentStatus: PaymentStatus.SUCCESS,
            startDatetime: new Date("2026-05-21T08:00:00.000Z"),
            payments: [payment]
          }),
          user: buildUser()
        }),
        update: vi.fn().mockResolvedValue({ bookingId }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(cancelledBooking)
      },
      bookingStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      refund: {
        create: vi.fn()
      }
    };
    const rules = {
      getEffectivePolicy: vi.fn().mockResolvedValue({
        holdMinutes: 10,
        cancelBeforeHours: 2,
        lateCheckinMinutes: 15,
        maxDurationMinutes: 120,
        maxBookingsPerDay: 2,
        advanceBookingDays: 7,
        canJoinWaitlist: true,
        refundRateUserOnTime: 80,
        refundRateManagerFault: 100
      })
    } as unknown as RulesRepository;
    const refunds = {
      createRefundForBooking: vi.fn().mockResolvedValue({ refundId, created: true })
    } as unknown as RefundsService;
    const service = createService(tx, { rules, refunds });

    const booking = await service.cancelMyBooking(userId, bookingId, {
      reason: "Schedule changed"
    });

    expect(booking).toMatchObject({
      id: bookingId,
      bookingStatus: BookingStatus.CANCELLED_BY_USER,
      refundable: true
    });
    expect(refunds.createRefundForBooking).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        bookingId,
        bookingStatus: BookingStatus.CONFIRMED,
        payment,
        refundRate: 80,
        refundReason: "Schedule changed",
        requestedByUserId: userId
      })
    );
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it("rejects confirmed user cancellation after the configured cancel window", async () => {
    const payment = {
      paymentId,
      bookingId,
      userId,
      amount: new Prisma.Decimal(100000),
      paymentMethod: "FAKE",
      gatewayTransactionId: "gw_1",
      paymentStatus: PaymentStatus.SUCCESS,
      rawCallback: null,
      paidAt: new Date("2026-05-20T01:00:00.000Z"),
      createdAt: now,
      updatedAt: now
    };
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          ...buildBooking({
            bookingStatus: BookingStatus.CONFIRMED,
            paymentStatus: PaymentStatus.SUCCESS,
            startDatetime: new Date("2026-05-20T01:00:00.000Z"),
            payments: [payment]
          }),
          user: buildUser()
        }),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn()
      },
      bookingStatusHistory: {
        create: vi.fn()
      },
      refund: {
        create: vi.fn()
      }
    };
    const rules = {
      getEffectivePolicy: vi.fn().mockResolvedValue({
        holdMinutes: 10,
        cancelBeforeHours: 2,
        lateCheckinMinutes: 15,
        maxDurationMinutes: 120,
        maxBookingsPerDay: 2,
        advanceBookingDays: 7,
        canJoinWaitlist: true,
        refundRateUserOnTime: 80,
        refundRateManagerFault: 100
      })
    } as unknown as RulesRepository;
    const refunds = {
      createRefundForBooking: vi.fn()
    } as unknown as RefundsService;
    const service = createService(tx, { rules, refunds });

    await expect(
      service.cancelMyBooking(userId, bookingId, {
        reason: "Too late"
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BOOKING_CANCEL_WINDOW_CLOSED"
    });
    expect(refunds.createRefundForBooking).not.toHaveBeenCalled();
    expect(tx.refund.create).not.toHaveBeenCalled();
    expect(tx.booking.update).not.toHaveBeenCalled();
  });
});
