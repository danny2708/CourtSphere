import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  type PrismaClient
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { MockRefundGateway } from "./refund-gateway.mock";
import { RefundsService } from "./refunds.service";

const adminUserId = "00000000-0000-4000-8000-000000001201";
const managerUserId = "00000000-0000-4000-8000-000000001202";
const userId = "00000000-0000-4000-8000-000000001203";
const bookingId = "00000000-0000-4000-8000-000000001204";
const paymentId = "00000000-0000-4000-8000-000000001205";
const refundId = "00000000-0000-4000-8000-000000001206";
const courtId = "00000000-0000-4000-8000-000000001207";
const priorityGroupId = "00000000-0000-4000-8000-000000001208";
const now = new Date("2026-05-20T00:00:00.000Z");

function buildPayment(overrides: Record<string, unknown> = {}) {
  return {
    paymentId,
    bookingId,
    userId,
    amount: new Prisma.Decimal(50000),
    paymentMethod: "MOCK",
    gatewayTransactionId: "mock_tx_1",
    paymentStatus: PaymentStatus.SUCCESS,
    rawCallback: null,
    paidAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function buildManagerBooking(overrides: Record<string, unknown> = {}) {
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
    bookingStatus: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.SUCCESS,
    refundable: true,
    holdExpiresAt: null,
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
      priorityGroupId,
      fullName: "Sample User",
      email: "user@example.edu",
      phoneNumber: null,
      passwordHash: "hash",
      identityCode: "STUDENT001",
      accountStatus: "ACTIVE",
      bookingPermissionStatus: "ALLOWED",
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
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now
      }
    },
    court: {
      courtId,
      courtName: "Main Field",
      location: "North Campus"
    },
    payments: [buildPayment()],
    ...overrides
  };
}

function buildRefund(overrides: Record<string, unknown> = {}) {
  const payment = buildPayment();
  const booking = buildManagerBooking({ payments: [payment] });

  return {
    refundId,
    paymentId,
    bookingId,
    refundAmount: new Prisma.Decimal(50000),
    refundReason: "Court maintenance",
    refundStatus: RefundStatus.REQUESTED,
    requestedByUserId: managerUserId,
    processedByUserId: null,
    gatewayRefundId: null,
    requestedAt: now,
    processedAt: null,
    updatedAt: now,
    payment,
    booking,
    requestedBy: {
      userId: managerUserId,
      fullName: "Manager User",
      email: "manager@example.edu"
    },
    processedBy: null,
    ...overrides
  };
}

function bookingRule(overrides: Record<string, unknown> = {}) {
  return {
    bookingRuleId: "00000000-0000-4000-8000-000000001209",
    ruleName: "DEFAULT",
    holdMinutes: 10,
    cancelBeforeHours: 2,
    lateCheckinMinutes: 15,
    maxBookingsPerDay: 2,
    maxDurationMinutes: 120,
    violationThreshold: 3,
    bookingBanDays: 7,
    refundRateUserOnTime: 100,
    refundRateManagerFault: 100,
    status: "ACTIVE",
    updatedByUserId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createGateway(status: RefundStatus = RefundStatus.SUCCESS) {
  return {
    processRefund: vi.fn().mockReturnValue({
      refundStatus: status,
      ...(status === RefundStatus.SUCCESS ? { gatewayRefundId: "mock_refund_1" } : {})
    })
  } as unknown as MockRefundGateway;
}

function createService(input: {
  tx?: unknown;
  refund?: unknown;
  refunds?: unknown[];
  gateway?: MockRefundGateway;
}) {
  const db = {
    $transaction: vi.fn((callback) => callback(input.tx)),
    refund: {
      findUnique: vi.fn().mockResolvedValue(input.refund ?? buildRefund()),
      findMany: vi.fn().mockResolvedValue(input.refunds ?? [input.refund ?? buildRefund()])
    }
  } as unknown as PrismaClient;

  return {
    service: new RefundsService(db, input.gateway ?? createGateway(), undefined, () => now),
    db: db as unknown as {
      $transaction: ReturnType<typeof vi.fn>;
      refund: {
        findUnique: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    }
  };
}

describe("RefundsService", () => {
  it("creates a requested refund from a successful payment", async () => {
    const tx = {
      refund: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ refundId })
      }
    };
    const { service } = createService({});

    const result = await service.createRefundForBooking(tx as never, {
      bookingId,
      bookingStatus: BookingStatus.CONFIRMED,
      payment: buildPayment(),
      refundRate: 80,
      refundReason: "Schedule changed",
      requestedByUserId: userId
    });

    expect(result).toEqual({ refundId, created: true });
    expect(tx.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId,
          bookingId,
          refundAmount: new Prisma.Decimal(40000),
          refundReason: "Schedule changed",
          refundStatus: RefundStatus.REQUESTED,
          requestedByUserId: userId
        })
      })
    );
  });

  it("does not create duplicate active refunds for the same booking/payment", async () => {
    const tx = {
      refund: {
        findFirst: vi.fn().mockResolvedValue({ refundId }),
        create: vi.fn()
      }
    };
    const { service } = createService({});

    const result = await service.createRefundForBooking(tx as never, {
      bookingId,
      bookingStatus: BookingStatus.CONFIRMED,
      payment: buildPayment(),
      refundRate: 100,
      refundReason: "Schedule changed",
      requestedByUserId: userId
    });

    expect(result).toEqual({ refundId, created: false });
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it("does not create refunds for CHECKIN_EXPIRED or NO_SHOW bookings", async () => {
    const tx = {
      refund: {
        findFirst: vi.fn(),
        create: vi.fn()
      }
    };
    const { service } = createService({});

    const checkinExpired = await service.createRefundForBooking(tx as never, {
      bookingId,
      bookingStatus: BookingStatus.CHECKIN_EXPIRED,
      payment: buildPayment(),
      refundRate: 100,
      refundReason: "Not refundable",
      requestedByUserId: userId
    });
    const noShow = await service.createRefundForBooking(tx as never, {
      bookingId,
      bookingStatus: BookingStatus.NO_SHOW,
      payment: buildPayment(),
      refundRate: 100,
      refundReason: "Not refundable",
      requestedByUserId: userId
    });

    expect(checkinExpired).toBeNull();
    expect(noShow).toBeNull();
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it("manager cancel on confirmed booking creates CANCELLED_BY_MANAGER, refund, history, and audit", async () => {
    const tx = {
      booking: {
        findUnique: vi.fn().mockResolvedValue(buildManagerBooking()),
        update: vi.fn().mockResolvedValue(
          buildManagerBooking({
            bookingStatus: BookingStatus.CANCELLED_BY_MANAGER,
            cancelledByUserId: managerUserId,
            cancelledAt: now,
            cancelReason: "Court maintenance"
          })
        )
      },
      bookingRule: {
        findFirst: vi.fn().mockResolvedValue(bookingRule())
      },
      priorityPolicy: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      refund: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ refundId })
      },
      bookingStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const { service } = createService({ tx, refund: buildRefund() });

    const result = await service.cancelBookingDueToCourtIssue(
      bookingId,
      { reason: "Court maintenance" },
      {
        actorUserId: managerUserId,
        roles: ["FIELD_MANAGER"]
      }
    );

    expect(result.booking.bookingStatus).toBe(BookingStatus.CANCELLED_BY_MANAGER);
    expect(result.refund).toMatchObject({
      id: refundId,
      refundStatus: RefundStatus.REQUESTED,
      refundAmount: 50000
    });
    expect(tx.refund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refundAmount: new Prisma.Decimal(50000),
          refundStatus: RefundStatus.REQUESTED,
          requestedByUserId: managerUserId
        })
      })
    );
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.CONFIRMED,
          newStatus: BookingStatus.CANCELLED_BY_MANAGER,
          actionType: "MANAGER_CANCEL_BOOKING",
          actionByUserId: managerUserId
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: managerUserId,
          entityType: "BOOKING",
          action: "MANAGER_CANCEL_BOOKING"
        })
      })
    );
  });

  it("admin cancel on confirmed booking creates CANCELLED_BY_ADMIN and refund", async () => {
    const tx = {
      booking: {
        findUnique: vi.fn().mockResolvedValue(buildManagerBooking()),
        update: vi.fn().mockResolvedValue(
          buildManagerBooking({
            bookingStatus: BookingStatus.CANCELLED_BY_ADMIN,
            cancelledByUserId: adminUserId,
            cancelledAt: now,
            cancelReason: "System incident"
          })
        )
      },
      bookingRule: {
        findFirst: vi.fn().mockResolvedValue(bookingRule())
      },
      priorityPolicy: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      refund: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ refundId })
      },
      bookingStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const { service } = createService({ tx, refund: buildRefund() });

    const result = await service.cancelBookingDueToCourtIssue(
      bookingId,
      { reason: "System incident" },
      {
        actorUserId: adminUserId,
        roles: ["ADMIN"]
      }
    );

    expect(result.booking.bookingStatus).toBe(BookingStatus.CANCELLED_BY_ADMIN);
    expect(result.refund?.refundAmount).toBe(50000);
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          newStatus: BookingStatus.CANCELLED_BY_ADMIN,
          actionType: "ADMIN_CANCEL_BOOKING"
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ADMIN_CANCEL_BOOKING"
        })
      })
    );
  });

  it("lists refunds for admin with filters", async () => {
    const { service, db } = createService({});

    const refunds = await service.listRefundsForAdmin({
      refundStatus: RefundStatus.REQUESTED,
      bookingCode: "BK",
      userId,
      paymentId,
      fromDate: new Date("2026-05-20T00:00:00.000Z"),
      toDate: new Date("2026-05-21T00:00:00.000Z")
    });

    expect(refunds).toHaveLength(1);
    expect(db.refund.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          refundStatus: RefundStatus.REQUESTED,
          paymentId,
          booking: expect.objectContaining({
            userId,
            bookingCode: expect.objectContaining({
              contains: "BK"
            })
          })
        })
      })
    );
  });

  it("admin retry refund success updates status and writes audit logs", async () => {
    const tx = {
      refund: {
        findUnique: vi.fn().mockResolvedValue(buildRefund({ refundStatus: RefundStatus.REQUESTED })),
        update: vi.fn().mockResolvedValue(
          buildRefund({
            refundStatus: RefundStatus.SUCCESS,
            processedByUserId: adminUserId,
            processedAt: now,
            gatewayRefundId: "mock_refund_1",
            processedBy: {
              userId: adminUserId,
              fullName: "Admin User",
              email: "admin@example.edu"
            }
          })
        )
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const gateway = createGateway(RefundStatus.SUCCESS);
    const { service } = createService({ tx, gateway });

    const refund = await service.retryRefund(
      refundId,
      { mockResult: RefundStatus.SUCCESS },
      { actorUserId: adminUserId, roles: ["ADMIN"] }
    );

    expect(refund.refundStatus).toBe(RefundStatus.SUCCESS);
    expect(tx.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refundStatus: RefundStatus.SUCCESS,
          processedByUserId: adminUserId,
          processedAt: now
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("admin retry refund fail updates status and writes audit logs", async () => {
    const tx = {
      refund: {
        findUnique: vi.fn().mockResolvedValue(buildRefund({ refundStatus: RefundStatus.FAILED })),
        update: vi.fn().mockResolvedValue(
          buildRefund({
            refundStatus: RefundStatus.FAILED,
            processedByUserId: adminUserId,
            processedBy: {
              userId: adminUserId,
              fullName: "Admin User",
              email: "admin@example.edu"
            }
          })
        )
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const gateway = createGateway(RefundStatus.FAILED);
    const { service } = createService({ tx, gateway });

    const refund = await service.retryRefund(
      refundId,
      { mockResult: RefundStatus.FAILED },
      { actorUserId: adminUserId, roles: ["ADMIN"] }
    );

    expect(refund.refundStatus).toBe(RefundStatus.FAILED);
    expect(tx.refund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refundStatus: RefundStatus.FAILED,
          processedByUserId: adminUserId
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
  });
});
