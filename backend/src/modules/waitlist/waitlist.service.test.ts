import {
  AccountStatus,
  BookingPermissionStatus,
  BookingStatus,
  CourtStatus,
  EntityStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  WaitlistStatus,
  type PrismaClient
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { BookingStateService } from "../bookings/booking-state.service";
import { WaitlistService } from "./waitlist.service";

const userId = "00000000-0000-4000-8000-000000002101";
const otherUserId = "00000000-0000-4000-8000-000000002102";
const courtId = "00000000-0000-4000-8000-000000002103";
const courtTypeId = "00000000-0000-4000-8000-000000002104";
const priorityGroupId = "00000000-0000-4000-8000-000000002105";
const waitlistEntryId = "00000000-0000-4000-8000-000000002106";
const bookingOrderId = "00000000-0000-4000-8000-000000002107";
const bookingItemId = "00000000-0000-4000-8000-000000002108";
const conflictingBookingOrderId = "00000000-0000-4000-8000-000000002109";
const conflictingBookingItemId = "00000000-0000-4000-8000-000000002110";
const now = new Date("2026-05-20T00:00:00.000Z");
const startDatetime = new Date("2026-05-21T08:00:00.000Z");
const endDatetime = new Date("2026-05-21T09:00:00.000Z");

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
        operatingHourId: "00000000-0000-4000-8000-000000002111",
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
        pricingRuleId: "00000000-0000-4000-8000-000000002112",
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

function buildWaitlistEntry(overrides: Record<string, unknown> = {}) {
  return {
    waitlistEntryId,
    userId,
    courtId,
    priorityGroupId,
    desiredStartDatetime: startDatetime,
    desiredEndDatetime: endDatetime,
    priorityOrder: 2,
    status: WaitlistStatus.WAITING,
    registeredAt: now,
    notifiedAt: null,
    expiresAt: null,
    court: buildCourt(),
    priorityGroup: buildUser().priorityGroup,
    ...overrides
  };
}

function buildWaitlistEntryForBooking(overrides: Record<string, unknown> = {}) {
  return {
    ...buildWaitlistEntry({
      status: WaitlistStatus.NOTIFIED,
      notifiedAt: now,
      expiresAt: new Date("2026-05-20T00:10:00.000Z")
    }),
    user: buildUser(),
    ...overrides
  };
}

function buildConflict() {
  return {
    bookingItemId: conflictingBookingItemId,
    bookingOrderId: conflictingBookingOrderId,
    bookingStatus: BookingStatus.CONFIRMED,
    startDatetime,
    endDatetime,
    bookingOrder: {
      holdExpiresAt: null
    }
  };
}

function buildBookingOrder() {
  return {
    bookingOrderId,
    bookingCode: "BK-20260520-WAIT01",
    userId,
    totalAmount: new Prisma.Decimal(50000),
    bookingStatus: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.INITIATED,
    refundable: true,
    holdExpiresAt: new Date("2026-05-20T00:10:00.000Z"),
    note: "Created from waitlist notification",
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        bookingItemId,
        bookingOrderId,
        courtId,
        startDatetime,
        endDatetime,
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
        court: {
          courtId,
          courtName: "Main Field",
          status: CourtStatus.ACTIVE
        }
      }
    ]
  };
}

function bookingRule() {
  return {
    holdMinutes: 10,
    cancelBeforeHours: 2,
    lateCheckinMinutes: 15,
    maxBookingsPerDay: 2,
    maxDurationMinutes: 120,
    violationThreshold: 3,
    bookingBanDays: 7,
    refundRateUserOnTime: 100,
    refundRateManagerFault: 100
  };
}

function createState() {
  return {
    expireOverlappingPaymentHolds: vi.fn().mockResolvedValue(undefined),
    recordOrderStatusHistory: vi.fn().mockResolvedValue(undefined),
    recordItemStatusHistory: vi.fn().mockResolvedValue(undefined)
  } as unknown as BookingStateService;
}

function createTransactionDb(tx: unknown) {
  return {
    $transaction: vi.fn((callback) => callback(tx)),
    waitlistEntry: (tx as { waitlistEntry?: unknown }).waitlistEntry
  } as unknown as PrismaClient;
}

function createTx(input: {
  user?: unknown;
  court?: unknown;
  conflicts?: unknown[];
  duplicate?: boolean;
  waitlistEntry?: unknown;
  notifyCandidate?: unknown;
  waitlistUpdateCount?: number;
  existingBookingCount?: number;
} = {}) {
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue(input.user ?? buildUser())
    },
    bookingRule: {
      findFirst: vi.fn().mockResolvedValue(bookingRule())
    },
    priorityPolicy: {
      findFirst: vi.fn().mockResolvedValue(null)
    },
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue({ settingValue: "10" })
    },
    court: {
      findUnique: vi.fn().mockResolvedValue(input.court ?? buildCourt())
    },
    bookingItem: {
      findMany: vi.fn().mockResolvedValue(input.conflicts ?? []),
      findFirstOrThrow: vi.fn().mockResolvedValue({ bookingItemId })
    },
    bookingOrder: {
      count: vi.fn().mockResolvedValue(input.existingBookingCount ?? 0),
      create: vi.fn().mockResolvedValue({
        bookingOrderId,
        bookingCode: "BK-20260520-WAIT01"
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(buildBookingOrder())
    },
    waitlistEntry: {
      create: vi.fn().mockResolvedValue(buildWaitlistEntry()),
      update: vi.fn().mockResolvedValue(
        buildWaitlistEntry({
          status: WaitlistStatus.CANCELLED
        })
      ),
      updateMany: vi.fn().mockResolvedValue({ count: input.waitlistUpdateCount ?? 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(
        buildWaitlistEntry({
          status: WaitlistStatus.NOTIFIED,
          notifiedAt: now,
          expiresAt: new Date("2026-05-20T00:10:00.000Z")
        })
      ),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(async (args: { where?: Record<string, unknown> }) => {
        if (args.where?.status === WaitlistStatus.WAITING && args.where?.courtId) {
          return input.notifyCandidate ?? null;
        }

        if (args.where?.waitlistEntryId && args.where?.userId) {
          return Object.prototype.hasOwnProperty.call(input, "waitlistEntry")
            ? input.waitlistEntry
            : buildWaitlistEntry();
        }

        if (args.where?.userId && args.where?.status) {
          return input.duplicate ? { waitlistEntryId } : null;
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

function createService(tx: unknown, state = createState()) {
  return {
    service: new WaitlistService(
      createTransactionDb(tx),
      undefined,
      state,
      undefined,
      () => now,
      () => "BK-20260520-WAIT01"
    ),
    state
  };
}

describe("WaitlistService", () => {
  it("joins waitlist when the slot is held or booked", async () => {
    const tx = createTx({ conflicts: [buildConflict()] });
    const { service } = createService(tx);

    const entry = await service.joinWaitlist(userId, {
      courtId,
      startDatetime,
      endDatetime
    });

    expect(entry).toMatchObject({
      id: waitlistEntryId,
      status: WaitlistStatus.WAITING,
      priorityOrder: 2
    });
    expect(tx.waitlistEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          courtId,
          desiredStartDatetime: startDatetime,
          desiredEndDatetime: endDatetime,
          status: WaitlistStatus.WAITING
        })
      })
    );
  });

  it("does not join waitlist when the slot is available", async () => {
    const tx = createTx({ conflicts: [] });
    const { service } = createService(tx);

    await expect(
      service.joinWaitlist(userId, {
        courtId,
        startDatetime,
        endDatetime
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "WAITLIST_SLOT_AVAILABLE"
    });
    expect(tx.waitlistEntry.create).not.toHaveBeenCalled();
  });

  it("rejects inactive courts, restricted users, and active duplicates", async () => {
    const inactiveCourt = createTx({
      court: buildCourt({ status: CourtStatus.MAINTENANCE }),
      conflicts: [buildConflict()]
    });
    const restrictedUser = createTx({
      user: buildUser({ bookingPermissionStatus: BookingPermissionStatus.RESTRICTED }),
      conflicts: [buildConflict()]
    });
    const duplicate = createTx({ conflicts: [buildConflict()], duplicate: true });

    await expect(
      createService(inactiveCourt).service.joinWaitlist(userId, {
        courtId,
        startDatetime,
        endDatetime
      })
    ).rejects.toMatchObject({ code: "COURT_NOT_AVAILABLE" });
    await expect(
      createService(restrictedUser).service.joinWaitlist(userId, {
        courtId,
        startDatetime,
        endDatetime
      })
    ).rejects.toMatchObject({ code: "BOOKING_PERMISSION_RESTRICTED" });
    await expect(
      createService(duplicate).service.joinWaitlist(userId, {
        courtId,
        startDatetime,
        endDatetime
      })
    ).rejects.toMatchObject({ code: "WAITLIST_ALREADY_EXISTS" });
  });

  it("notifies next waitlist entry by priority order and registered time", async () => {
    const candidate = buildWaitlistEntry({
      status: WaitlistStatus.WAITING,
      priorityOrder: 1
    });
    const tx = createTx({ conflicts: [], notifyCandidate: candidate });
    const { service } = createService(tx);

    const notified = await service.notifyNextForSlot({
      courtId,
      startDatetime,
      endDatetime
    });

    expect(notified).toMatchObject({
      id: waitlistEntryId,
      status: WaitlistStatus.NOTIFIED
    });
    expect(tx.waitlistEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priorityOrder: "asc" }, { registeredAt: "asc" }]
      })
    );
    expect(tx.waitlistEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WaitlistStatus.NOTIFIED,
          expiresAt: new Date("2026-05-20T00:10:00.000Z")
        })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          notificationType: NotificationType.WAITLIST_NOTIFIED
        })
      })
    );
  });

  it("does not notify next waitlist entry while the slot is still active", async () => {
    const tx = createTx({
      conflicts: [buildConflict()],
      notifyCandidate: buildWaitlistEntry({ status: WaitlistStatus.WAITING })
    });
    const { service } = createService(tx);

    const notified = await service.notifyNextForSlot({
      courtId,
      startDatetime,
      endDatetime
    });

    expect(notified).toBeNull();
    expect(tx.waitlistEntry.updateMany).not.toHaveBeenCalled();
  });

  it("books from a notified waitlist entry as a pending-payment booking order", async () => {
    const tx = createTx({
      conflicts: [],
      waitlistEntry: buildWaitlistEntryForBooking()
    });
    const { service, state } = createService(tx);

    const booking = await service.bookFromWaitlist(userId, { waitlistEntryId });

    expect(booking).toMatchObject({
      bookingOrderId,
      bookingStatus: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.INITIATED,
      totalAmount: 50000,
      items: [
        {
          bookingItemId,
          itemStatus: BookingStatus.PENDING_PAYMENT
        }
      ]
    });
    expect(tx.waitlistEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: WaitlistStatus.BOOKED
        }
      })
    );
    expect(tx.bookingOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.INITIATED,
          items: {
            create: [
              expect.objectContaining({
                courtId,
                bookingStatus: BookingStatus.PENDING_PAYMENT
              })
            ]
          }
        })
      })
    );
    expect(state.recordOrderStatusHistory).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        newStatus: BookingStatus.PENDING_PAYMENT,
        actionType: "USER_CREATE_BOOKING_ORDER_FROM_WAITLIST"
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingOrderId,
          notificationType: NotificationType.BOOKING_CREATED
        })
      })
    );
  });

  it("rejects booking from waitlist for invalid statuses or another owner", async () => {
    const waitingTx = createTx({
      waitlistEntry: buildWaitlistEntryForBooking({ status: WaitlistStatus.WAITING })
    });
    const expiredTx = createTx({
      waitlistEntry: buildWaitlistEntryForBooking({ status: WaitlistStatus.EXPIRED })
    });
    const cancelledTx = createTx({
      waitlistEntry: buildWaitlistEntryForBooking({ status: WaitlistStatus.CANCELLED })
    });
    const bookedTx = createTx({
      waitlistEntry: buildWaitlistEntryForBooking({ status: WaitlistStatus.BOOKED })
    });
    const otherOwnerTx = createTx({ waitlistEntry: null });

    await expect(
      createService(waitingTx).service.bookFromWaitlist(userId, { waitlistEntryId })
    ).rejects.toMatchObject({ code: "WAITLIST_ENTRY_NOT_NOTIFIED" });
    await expect(
      createService(expiredTx).service.bookFromWaitlist(userId, { waitlistEntryId })
    ).rejects.toMatchObject({ code: "WAITLIST_ENTRY_EXPIRED" });
    await expect(
      createService(cancelledTx).service.bookFromWaitlist(userId, { waitlistEntryId })
    ).rejects.toMatchObject({ code: "WAITLIST_ENTRY_CANCELLED" });
    await expect(
      createService(bookedTx).service.bookFromWaitlist(userId, { waitlistEntryId })
    ).rejects.toMatchObject({ code: "WAITLIST_ENTRY_ALREADY_BOOKED" });
    await expect(
      createService(otherOwnerTx).service.bookFromWaitlist(otherUserId, { waitlistEntryId })
    ).rejects.toMatchObject({ code: "WAITLIST_ENTRY_NOT_FOUND" });
  });

  it("does not book from waitlist if the slot was taken again", async () => {
    const tx = createTx({
      conflicts: [buildConflict()],
      waitlistEntry: buildWaitlistEntryForBooking()
    });
    const { service } = createService(tx);

    await expect(service.bookFromWaitlist(userId, { waitlistEntryId })).rejects.toMatchObject({
      code: "WAITLIST_SLOT_TAKEN"
    });
    expect(tx.bookingOrder.create).not.toHaveBeenCalled();
  });

  it("expires notified waitlist entries and notifies the next waiting entry", async () => {
    const expiredEntry = {
      waitlistEntryId,
      userId,
      courtId,
      desiredStartDatetime: startDatetime,
      desiredEndDatetime: endDatetime,
      status: WaitlistStatus.NOTIFIED,
      expiresAt: new Date("2026-05-19T23:59:00.000Z")
    };
    const nextEntry = buildWaitlistEntry({
      waitlistEntryId: "00000000-0000-4000-8000-000000002120",
      status: WaitlistStatus.WAITING
    });
    const tx = createTx({ conflicts: [], notifyCandidate: nextEntry });

    tx.waitlistEntry.findMany.mockResolvedValue([{ waitlistEntryId }]);
    tx.waitlistEntry.findFirst.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
      if (args.where?.waitlistEntryId && args.where?.status === WaitlistStatus.NOTIFIED) {
        return expiredEntry;
      }

      if (args.where?.status === WaitlistStatus.WAITING && args.where?.courtId) {
        return nextEntry;
      }

      return null;
    });

    const { service } = createService(tx);
    const result = await service.expireNotifiedEntries({ now, batchSize: 10 });

    expect(result.processed).toBe(1);
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
          notificationType: NotificationType.WAITLIST_EXPIRED
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "AUTO_EXPIRE_WAITLIST_ENTRY"
        })
      })
    );
  });
});
