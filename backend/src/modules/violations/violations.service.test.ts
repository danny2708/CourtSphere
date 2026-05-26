import {
  BookingPermissionStatus,
  BookingStatus,
  EntityStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  ViolationType,
  type PrismaClient
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ViolationsService } from "./violations.service";

const adminUserId = "00000000-0000-4000-8000-000000002201";
const userId = "00000000-0000-4000-8000-000000002202";
const bookingOrderId = "00000000-0000-4000-8000-000000002203";
const bookingItemId = "00000000-0000-4000-8000-000000002204";
const violationId = "00000000-0000-4000-8000-000000002205";
const now = new Date("2026-05-20T08:00:00.000Z");

function bookingRule(overrides: Record<string, unknown> = {}) {
  return {
    bookingRuleId: "00000000-0000-4000-8000-000000002206",
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
    status: EntityStatus.ACTIVE,
    updatedByUserId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    userId,
    fullName: "Sample User",
    email: "user@example.edu",
    bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
    bookingLockedUntil: null,
    violationPoints: 1,
    ...overrides
  };
}

function buildViolation(overrides: Record<string, unknown> = {}) {
  return {
    violationId,
    userId,
    bookingItemId,
    violationType: ViolationType.NO_SHOW,
    penaltyPoints: 1,
    description: "User did not arrive",
    recordedByUserId: adminUserId,
    isWaived: false,
    recordedAt: now,
    user: buildUser(),
    bookingItem: {
      bookingItemId,
      bookingOrderId,
      courtId: "00000000-0000-4000-8000-000000002207",
      startDatetime: now,
      endDatetime: new Date("2026-05-20T09:00:00.000Z"),
      unitPrice: new Prisma.Decimal(50000),
      amount: new Prisma.Decimal(50000),
      bookingStatus: BookingStatus.CHECKIN_EXPIRED,
      checkinTime: null,
      checkedInByUserId: null,
      completedByUserId: null,
      noShowMarkedByUserId: null,
      managerNote: null,
      createdAt: now,
      updatedAt: now,
      court: {
        courtId: "00000000-0000-4000-8000-000000002207",
        courtName: "Main Field"
      },
      bookingOrder: {
        bookingOrderId,
        bookingCode: "BK-20260520-TEST01",
        bookingStatus: BookingStatus.CHECKIN_EXPIRED,
        paymentStatus: PaymentStatus.SUCCESS
      }
    },
    recordedBy: {
      userId: adminUserId,
      fullName: "Admin User",
      email: "admin@example.edu"
    },
    ...overrides
  };
}

function createTransactionDb(tx: unknown, models: Record<string, unknown> = {}) {
  return {
    $transaction: vi.fn((callback) => callback(tx)),
    ...models
  } as unknown as PrismaClient;
}

function createTx(input: {
  violation?: unknown;
  user?: unknown;
  bookingRule?: unknown;
  lateCancelEnabled?: string;
  lateCancelPenalty?: string;
  existingViolation?: unknown;
} = {}) {
  const tx = {
    violation: {
      findMany: vi.fn().mockResolvedValue([input.violation ?? buildViolation()]),
      findUnique: vi.fn().mockResolvedValue(input.violation ?? buildViolation()),
      findFirst: vi.fn().mockResolvedValue(input.existingViolation ?? null),
      create: vi.fn().mockResolvedValue(input.violation ?? buildViolation()),
      update: vi.fn().mockResolvedValue(input.violation ?? buildViolation())
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(input.user ?? buildUser()),
      update: vi.fn().mockResolvedValue({})
    },
    bookingRule: {
      findFirst: vi.fn().mockResolvedValue(input.bookingRule ?? bookingRule())
    },
    systemSetting: {
      findUnique: vi.fn(async ({ where }: { where: { settingKey: string } }) => {
        if (where.settingKey === "late_cancellation_violation_enabled") {
          return { settingValue: input.lateCancelEnabled ?? "true" };
        }

        if (where.settingKey === "late_cancellation_penalty_points") {
          return { settingValue: input.lateCancelPenalty ?? "1" };
        }

        return null;
      })
    },
    notification: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({})
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    }
  };

  return tx;
}

const audit = {
  actorUserId: adminUserId,
  roles: ["ADMIN"],
  ipAddress: "127.0.0.1",
  userAgent: "vitest"
};

describe("ViolationsService", () => {
  it("lists violations with related user and booking item summary", async () => {
    const tx = createTx();
    const service = new ViolationsService(
      createTransactionDb(tx, {
        violation: tx.violation
      }),
      () => now
    );

    const violations = await service.listViolations({
      userId,
      violationType: ViolationType.NO_SHOW,
      isWaived: false,
      bookingItemId
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      violationId,
      user: {
        id: userId
      },
      bookingItem: {
        bookingOrder: {
          bookingCode: "BK-20260520-TEST01"
        }
      }
    });
    expect(tx.violation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId,
          violationType: ViolationType.NO_SHOW,
          isWaived: false,
          bookingItemId
        })
      })
    );
  });

  it("creates a violation, updates points, restricts user, and sends notifications", async () => {
    const tx = createTx({
      user: buildUser({ violationPoints: 2 }),
      bookingRule: bookingRule({ violationThreshold: 3 })
    });
    const service = new ViolationsService(createTransactionDb(tx), () => now);

    const result = await service.createViolation(tx as never, {
      userId,
      bookingItemId,
      violationType: ViolationType.NO_SHOW,
      penaltyPoints: 1,
      description: "No-show",
      recordedByUserId: adminUserId
    });

    expect(result.created).toBe(true);
    expect(result.restrictedUser).toBe(true);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          violationPoints: 3,
          bookingPermissionStatus: BookingPermissionStatus.RESTRICTED,
          bookingLockedUntil: new Date("2026-05-27T08:00:00.000Z")
        })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingItemId,
          notificationType: NotificationType.VIOLATION_RECORDED
        })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingItemId,
          notificationType: NotificationType.BOOKING_PERMISSION_RESTRICTED
        })
      })
    );
  });

  it("does not create duplicate violation for the same booking item and type", async () => {
    const existingViolation = buildViolation();
    const tx = createTx({ existingViolation });
    const service = new ViolationsService(createTransactionDb(tx), () => now);

    const result = await service.createViolation(tx as never, {
      userId,
      bookingItemId,
      violationType: ViolationType.NO_SHOW,
      penaltyPoints: 1
    });

    expect(result.created).toBe(false);
    expect(tx.violation.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("creates late cancellation violation only when policy enables it", async () => {
    const tx = createTx({ lateCancelEnabled: "true", lateCancelPenalty: "2" });
    const service = new ViolationsService(createTransactionDb(tx), () => now);

    const result = await service.createLateCancelViolationIfNeeded(tx as never, {
      userId,
      reason: "Too late",
      items: [
        {
          bookingItemId,
          startDatetime: now,
          bookingStatus: BookingStatus.CONFIRMED
        }
      ]
    });

    expect(result?.created).toBe(true);
    expect(tx.violation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          violationType: ViolationType.LATE_CANCEL,
          penaltyPoints: 2,
          description: "Too late"
        })
      })
    );

    const disabledTx = createTx({ lateCancelEnabled: "false" });
    const disabledService = new ViolationsService(createTransactionDb(disabledTx), () => now);

    await expect(
      disabledService.createLateCancelViolationIfNeeded(disabledTx as never, {
        userId,
        items: [
          {
            bookingItemId,
            startDatetime: now,
            bookingStatus: BookingStatus.CONFIRMED
          }
        ]
      })
    ).resolves.toBeNull();
    expect(disabledTx.violation.create).not.toHaveBeenCalled();
  });

  it("waives violation, subtracts points, and writes audit log", async () => {
    const tx = createTx({
      violation: buildViolation({ penaltyPoints: 2 }),
      user: buildUser({ violationPoints: 2 })
    });
    const service = new ViolationsService(createTransactionDb(tx), () => now);

    await service.waiveViolation(violationId, { reason: "Valid excuse" }, audit);

    expect(tx.violation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          isWaived: true
        }
      })
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          violationPoints: 0
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "VIOLATION",
          action: "WAIVE_VIOLATION"
        })
      })
    );
  });

  it("adjusts violation points, applies delta, restricts user, and writes audit log", async () => {
    const tx = createTx({
      violation: buildViolation({ penaltyPoints: 1 }),
      user: buildUser({ violationPoints: 1 }),
      bookingRule: bookingRule({ violationThreshold: 3 })
    });
    const service = new ViolationsService(createTransactionDb(tx), () => now);

    await service.adjustViolationPoints(
      violationId,
      { penaltyPoints: 3, reason: "Severity updated" },
      audit
    );

    expect(tx.violation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          penaltyPoints: 3
        }
      })
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          violationPoints: 3,
          bookingPermissionStatus: BookingPermissionStatus.RESTRICTED
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "VIOLATION",
          action: "ADJUST_VIOLATION_POINTS"
        })
      })
    );
  });
});
