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

import { ViolationsService } from "../violations/violations.service";
import { ManagerService } from "./manager.service";

const managerUserId = "00000000-0000-4000-8000-000000001601";
const userId = "00000000-0000-4000-8000-000000001602";
const bookingOrderId = "00000000-0000-4000-8000-000000001603";
const bookingItemId = "00000000-0000-4000-8000-000000001604";
const courtId = "00000000-0000-4000-8000-000000001605";
const courtTypeId = "00000000-0000-4000-8000-000000001606";
const priorityGroupId = "00000000-0000-4000-8000-000000001607";
const violationId = "00000000-0000-4000-8000-000000001608";
const now = new Date("2026-05-20T08:00:00.000Z");

function bookingRule(overrides: Record<string, unknown> = {}) {
  return {
    bookingRuleId: "00000000-0000-4000-8000-000000001609",
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
    priorityGroupId,
    fullName: "Sample User",
    email: "user@example.edu",
    phoneNumber: null,
    passwordHash: "hash",
    identityCode: "STUDENT001",
    accountStatus: "ACTIVE",
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

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    bookingOrderId,
    bookingCode: "BK-20260520-TEST01",
    userId,
    totalAmount: new Prisma.Decimal(50000),
    bookingStatus: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.SUCCESS,
    refundable: true,
    holdExpiresAt: null,
    note: null,
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    user: buildUser(),
    ...overrides
  };
}

function buildItem(overrides: Record<string, unknown> = {}) {
  return {
    bookingItemId,
    bookingOrderId,
    courtId,
    startDatetime: now,
    endDatetime: new Date("2026-05-20T09:00:00.000Z"),
    unitPrice: new Prisma.Decimal(50000),
    amount: new Prisma.Decimal(50000),
    bookingStatus: BookingStatus.CONFIRMED,
    checkinTime: null,
    checkedInByUserId: null,
    completedByUserId: null,
    noShowMarkedByUserId: null,
    managerNote: null,
    createdAt: now,
    updatedAt: now,
    bookingOrder: buildOrder(),
    court: {
      courtId,
      courtTypeId,
      courtName: "Main Field",
      description: null,
      imageUrl: null,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      courtType: {
        courtTypeId,
        typeName: "Football",
        description: null,
        status: EntityStatus.ACTIVE,
        createdAt: now,
        updatedAt: now
      }
    },
    ...overrides
  };
}

function buildViolation() {
  return {
    violationId,
    userId,
    bookingItemId,
    violationType: ViolationType.NO_SHOW,
    penaltyPoints: 1,
    description: "User did not arrive",
    recordedByUserId: managerUserId,
    isWaived: false,
    recordedAt: now,
    user: buildUser({
      violationPoints: 3,
      bookingPermissionStatus: BookingPermissionStatus.RESTRICTED,
      bookingLockedUntil: new Date("2026-05-27T08:00:00.000Z")
    }),
    bookingItem: {
      ...buildItem(),
      bookingOrder: {
        bookingOrderId,
        bookingCode: "BK-20260520-TEST01",
        bookingStatus: BookingStatus.CHECKIN_EXPIRED,
        paymentStatus: PaymentStatus.SUCCESS
      },
      court: {
        courtId,
        courtName: "Main Field"
      }
    },
    recordedBy: {
      userId: managerUserId,
      fullName: "Manager User",
      email: "manager@example.edu"
    }
  };
}

function createTx(input: {
  item?: unknown;
  orderForRecompute?: unknown;
  bookingRule?: unknown;
  conflicts?: unknown[];
}) {
  return {
    bookingItem: {
      findUnique: vi.fn().mockResolvedValue(input.item ?? buildItem()),
      findMany: vi.fn().mockResolvedValue(input.conflicts ?? []),
      update: vi.fn().mockResolvedValue({})
    },
    bookingOrder: {
      findUnique: vi.fn().mockResolvedValue(
        input.orderForRecompute ?? {
          bookingOrderId,
          bookingStatus: BookingStatus.CONFIRMED,
          items: [{ bookingStatus: BookingStatus.IN_USE }]
        }
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    bookingRule: {
      findFirst: vi.fn().mockResolvedValue(input.bookingRule ?? bookingRule())
    },
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue({ settingValue: "1" })
    },
    bookingItemStatusHistory: {
      create: vi.fn().mockResolvedValue({})
    },
    bookingOrderStatusHistory: {
      create: vi.fn().mockResolvedValue({})
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    violation: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(buildViolation())
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        userId,
        violationPoints: 0,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
        bookingLockedUntil: null
      }),
      update: vi.fn().mockResolvedValue({})
    },
    refund: {
      create: vi.fn()
    },
    notification: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({})
    }
  };
}

function createService(input: {
  tx?: unknown;
  finalItem?: unknown;
  scheduleItems?: unknown[];
}) {
  const db = {
    $transaction: vi.fn((callback) => callback(input.tx)),
    bookingItem: {
      findUnique: vi.fn().mockResolvedValue(input.finalItem ?? buildItem()),
      findMany: vi.fn().mockResolvedValue(input.scheduleItems ?? [buildItem()])
    }
  } as unknown as PrismaClient;

  return {
    service: new ManagerService(
      db,
      undefined,
      undefined,
      () => now,
      undefined,
      new ViolationsService(db, () => now)
    ),
    db: db as unknown as {
      $transaction: ReturnType<typeof vi.fn>;
      bookingItem: {
        findUnique: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    }
  };
}

const audit = {
  actorUserId: managerUserId,
  roles: ["FIELD_MANAGER"]
};

describe("ManagerService", () => {
  it("lists today's booking item schedule", async () => {
    const { service, db } = createService({
      scheduleItems: [buildItem()]
    });

    const result = await service.getTodaySchedule({
      status: BookingStatus.CONFIRMED
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bookingItemId,
      bookingOrderId,
      bookingCode: "BK-20260520-TEST01",
      itemStatus: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.SUCCESS
    });
    expect(db.bookingItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingStatus: BookingStatus.CONFIRMED
        })
      })
    );
  });

  it("checks in a CONFIRMED paid booking item and writes history", async () => {
    const tx = createTx({
      item: buildItem(),
      orderForRecompute: {
        bookingOrderId,
        bookingStatus: BookingStatus.CONFIRMED,
        items: [{ bookingStatus: BookingStatus.IN_USE }]
      }
    });
    const { service } = createService({
      tx,
      finalItem: buildItem({
        bookingStatus: BookingStatus.IN_USE,
        checkinTime: now,
        checkedInByUserId: managerUserId
      })
    });

    const result = await service.checkInBookingItem(bookingItemId, audit);

    expect(result.itemStatus).toBe(BookingStatus.IN_USE);
    expect(tx.bookingItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.IN_USE,
          checkinTime: now,
          checkedInByUserId: managerUserId
        })
      })
    );
    expect(tx.bookingItemStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.CONFIRMED,
          newStatus: BookingStatus.IN_USE,
          actionType: "MANAGER_CHECK_IN_BOOKING_ITEM"
        })
      })
    );
    expect(tx.bookingOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bookingStatus: BookingStatus.IN_USE
        }
      })
    );
  });

  it("does not check in when the booking order is not paid", async () => {
    const tx = createTx({
      item: buildItem({
        bookingOrder: buildOrder({
          paymentStatus: PaymentStatus.PROCESSING
        })
      })
    });
    const { service } = createService({ tx });

    await expect(service.checkInBookingItem(bookingItemId, audit)).rejects.toMatchObject({
      code: "BOOKING_ORDER_NOT_PAID"
    });
    expect(tx.bookingItem.update).not.toHaveBeenCalled();
  });

  it.each([
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.PAYMENT_EXPIRED,
    BookingStatus.CANCELLED_BY_USER
  ])("does not check in %s booking items", async (status) => {
    const tx = createTx({
      item: buildItem({
        bookingStatus: status
      })
    });
    const { service } = createService({ tx });

    await expect(service.checkInBookingItem(bookingItemId, audit)).rejects.toMatchObject({
      code: "BOOKING_ITEM_CANNOT_CHECK_IN"
    });
    expect(tx.bookingItem.update).not.toHaveBeenCalled();
  });

  it("overrides late check-in from CHECKIN_EXPIRED to IN_USE and writes audit", async () => {
    const tx = createTx({
      item: buildItem({
        bookingStatus: BookingStatus.CHECKIN_EXPIRED
      })
    });
    const { service } = createService({
      tx,
      finalItem: buildItem({
        bookingStatus: BookingStatus.IN_USE,
        checkinTime: now,
        checkedInByUserId: managerUserId,
        managerNote: "User arrived late"
      })
    });

    const result = await service.overrideLateCheckin(
      bookingItemId,
      { reason: "User arrived late" },
      audit
    );

    expect(result.itemStatus).toBe(BookingStatus.IN_USE);
    expect(tx.bookingItem.findMany).toHaveBeenCalledOnce();
    expect(tx.bookingItemStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.CHECKIN_EXPIRED,
          newStatus: BookingStatus.IN_USE,
          actionType: "MANAGER_OVERRIDE_LATE_CHECKIN"
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "BOOKING_ITEM",
          action: "MANAGER_OVERRIDE_LATE_CHECKIN"
        })
      })
    );
  });

  it("marks CHECKIN_EXPIRED booking item no-show, creates violation, and writes audit/history", async () => {
    const tx = createTx({
      item: buildItem({
        bookingStatus: BookingStatus.CHECKIN_EXPIRED,
        bookingOrder: buildOrder({
          user: buildUser({
            violationPoints: 2
          })
        })
      })
    });
    tx.user.findUnique.mockResolvedValue({
      userId,
      violationPoints: 2,
      bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
      bookingLockedUntil: null
    });
    const { service } = createService({
      tx,
      finalItem: buildItem({
        bookingStatus: BookingStatus.NO_SHOW,
        noShowMarkedByUserId: managerUserId,
        managerNote: "User did not arrive"
      })
    });

    const result = await service.markNoShow(
      bookingItemId,
      { reason: "User did not arrive" },
      audit
    );

    expect(result.bookingItem.itemStatus).toBe(BookingStatus.NO_SHOW);
    expect(result.violation).toMatchObject({
      id: violationId,
      violationType: ViolationType.NO_SHOW,
      penaltyPoints: 1
    });
    expect(tx.violation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingItemId,
          violationType: ViolationType.NO_SHOW,
          penaltyPoints: 1,
          recordedByUserId: managerUserId
        })
      })
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          violationPoints: 3,
          bookingPermissionStatus: BookingPermissionStatus.RESTRICTED,
          bookingLockedUntil: new Date("2026-05-27T08:00:00.000Z")
        })
      })
    );
    expect(tx.bookingItemStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.CHECKIN_EXPIRED,
          newStatus: BookingStatus.NO_SHOW,
          actionType: "MANAGER_MARK_NO_SHOW"
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "MANAGER_MARK_NO_SHOW"
        })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingOrderId,
          bookingItemId,
          notificationType: NotificationType.NO_SHOW
        })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingOrderId,
          bookingItemId,
          notificationType: NotificationType.VIOLATION_RECORDED
        })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingOrderId,
          bookingItemId,
          notificationType: NotificationType.BOOKING_PERMISSION_RESTRICTED
        })
      })
    );
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it("overrides complete from IN_USE to COMPLETED and completes order when all items complete", async () => {
    const tx = createTx({
      item: buildItem({
        bookingStatus: BookingStatus.IN_USE,
        bookingOrder: buildOrder({
          bookingStatus: BookingStatus.IN_USE
        })
      }),
      orderForRecompute: {
        bookingOrderId,
        bookingStatus: BookingStatus.IN_USE,
        items: [{ bookingStatus: BookingStatus.COMPLETED }]
      }
    });
    const { service } = createService({
      tx,
      finalItem: buildItem({
        bookingStatus: BookingStatus.COMPLETED,
        completedByUserId: managerUserId,
        managerNote: "Closed early due to incident"
      })
    });

    const result = await service.overrideComplete(
      bookingItemId,
      { reason: "Closed early due to incident" },
      audit
    );

    expect(result.itemStatus).toBe(BookingStatus.COMPLETED);
    expect(tx.bookingItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.COMPLETED,
          completedByUserId: managerUserId
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
});
