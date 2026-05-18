import {
  BookingStatus,
  BookingPermissionStatus,
  CourtStatus,
  EntityStatus,
  type PrismaClient
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AvailabilityService } from "./availability.service";
import { RulesRepository } from "../rules/rules.repository";

const courtId = "00000000-0000-4000-8000-000000000301";
const userId = "00000000-0000-4000-8000-000000000302";
const priorityGroupId = "00000000-0000-4000-8000-000000000303";

function date(value: string): Date {
  return new Date(value);
}

function buildCourt(overrides: Record<string, unknown> = {}) {
  return {
    courtId,
    courtName: "Main Field",
    location: "North Campus",
    capacity: 22,
    description: null,
    imageUrl: null,
    status: CourtStatus.ACTIVE,
    courtType: {
      courtTypeId: "00000000-0000-4000-8000-000000000304",
      typeName: "Football",
      description: null,
      status: EntityStatus.ACTIVE
    },
    operatingHours: [
      {
        weekday: 3,
        openTime: "08:00",
        closeTime: "12:00",
        slotDurationMinutes: 60,
        status: EntityStatus.ACTIVE
      }
    ],
    pricingRules: [
      {
        priorityGroupId: null,
        applicableDay: null,
        startTime: "08:00",
        endTime: "12:00",
        priceAmount: "50000.00",
        effectiveFrom: null,
        effectiveTo: null
      }
    ],
    ...overrides
  };
}

function createService(input: {
  court?: unknown;
  bookings?: unknown[];
  priorityPolicy?: unknown;
  bookingRule?: unknown;
  rulesRepository?: unknown;
  now?: Date;
}) {
  const db = {
    court: {
      findUnique: vi.fn().mockResolvedValue(input.court ?? buildCourt())
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        userId,
        priorityGroupId,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
        priorityGroup: {
          priorityGroupId,
          groupCode: "STUDENT",
          groupName: "STUDENT",
          advanceBookingDays: 7
        }
      })
    },
    bookingRule: {
      findFirst: vi.fn().mockResolvedValue(
        input.bookingRule ?? {
          holdMinutes: 10,
          cancelBeforeHours: 2,
          lateCheckinMinutes: 15,
          maxDurationMinutes: 120,
          maxBookingsPerDay: 2,
          refundRateUserOnTime: 100,
          refundRateManagerFault: 100
        }
      )
    },
    priorityPolicy: {
      findFirst: vi.fn().mockResolvedValue(
        input.priorityPolicy ?? {
          advanceBookingDays: 7,
          maxDurationMinutes: 120,
          maxBookingsPerDay: 2,
          canJoinWaitlist: true
        }
      )
    },
    booking: {
      findMany: vi.fn().mockResolvedValue(input.bookings ?? [])
    }
  };

  return {
    service: new AvailabilityService(
      db as unknown as PrismaClient,
      undefined,
      () => input.now ?? date("2026-05-18T00:00:00.000Z"),
      (input.rulesRepository as RulesRepository | undefined) ??
        new RulesRepository(db as unknown as PrismaClient)
    ),
    db
  };
}

describe("AvailabilityService", () => {
  it("generates available slots with pricing", async () => {
    const { service } = createService({});

    const availability = await service.getCourtAvailability(courtId, userId, {
      date: "2026-05-20"
    });

    expect(availability.court).toMatchObject({
      id: courtId,
      courtName: "Main Field",
      status: "ACTIVE"
    });
    expect(availability.durationMinutes).toBe(60);
    expect(availability.slots).toHaveLength(4);
    expect(availability.slots[0]).toEqual({
      startDatetime: "2026-05-20T08:00:00.000Z",
      endDatetime: "2026-05-20T09:00:00.000Z",
      status: "AVAILABLE",
      priceAmount: 50000
    });
  });

  it("marks booked slots, active holds, and ignores expired holds", async () => {
    const { service } = createService({
      bookings: [
        {
          bookingId: "00000000-0000-4000-8000-000000000311",
          bookingStatus: BookingStatus.CONFIRMED,
          startDatetime: date("2026-05-20T08:30:00.000Z"),
          endDatetime: date("2026-05-20T09:30:00.000Z"),
          holdExpiresAt: null
        },
        {
          bookingId: "00000000-0000-4000-8000-000000000312",
          bookingStatus: BookingStatus.PENDING_PAYMENT,
          startDatetime: date("2026-05-20T10:00:00.000Z"),
          endDatetime: date("2026-05-20T11:00:00.000Z"),
          holdExpiresAt: date("2026-05-18T00:10:00.000Z")
        },
        {
          bookingId: "00000000-0000-4000-8000-000000000313",
          bookingStatus: BookingStatus.PENDING_PAYMENT,
          startDatetime: date("2026-05-20T11:00:00.000Z"),
          endDatetime: date("2026-05-20T12:00:00.000Z"),
          holdExpiresAt: date("2026-05-17T23:59:00.000Z")
        }
      ]
    });

    const availability = await service.getCourtAvailability(courtId, userId, {
      date: "2026-05-20"
    });

    expect(availability.slots.map((slot) => slot.status)).toEqual([
      "BOOKED",
      "BOOKED",
      "HOLD",
      "AVAILABLE"
    ]);
    expect(availability.slots[2]).toMatchObject({
      bookingId: "00000000-0000-4000-8000-000000000312",
      unavailableReason: "Slot is temporarily held pending payment"
    });
  });

  it("marks generated slots as maintenance when the court is under maintenance", async () => {
    const { service } = createService({
      court: buildCourt({
        status: CourtStatus.MAINTENANCE
      })
    });

    const availability = await service.getCourtAvailability(courtId, userId, {
      date: "2026-05-20"
    });

    expect(availability.slots.every((slot) => slot.status === "MAINTENANCE")).toBe(true);
    expect(availability.slots[0].unavailableReason).toBe("Court is under maintenance");
  });

  it("marks slots closed outside the user's advance booking window", async () => {
    const { service } = createService({});

    const availability = await service.getCourtAvailability(courtId, userId, {
      date: "2026-06-24"
    });

    expect(availability.slots.every((slot) => slot.status === "CLOSED")).toBe(true);
    expect(availability.slots[0].unavailableReason).toBe("Outside advance booking window");
  });

  it("rejects durationMinutes above the configured maximum", async () => {
    const { service } = createService({});

    await expect(
      service.getCourtAvailability(courtId, userId, {
        date: "2026-05-20",
        durationMinutes: 180
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "DURATION_EXCEEDS_LIMIT"
    });
  });

  it("uses the shared rules repository policy when calculating availability", async () => {
    const rulesRepository = {
      getEffectivePolicy: vi.fn().mockResolvedValue({
        holdMinutes: 5,
        cancelBeforeHours: 4,
        lateCheckinMinutes: 10,
        maxDurationMinutes: 30,
        maxBookingsPerDay: 4,
        advanceBookingDays: 3,
        canJoinWaitlist: false,
        refundRateUserOnTime: 80,
        refundRateManagerFault: 100
      })
    };
    const { service } = createService({ rulesRepository });

    const availability = await service.getCourtAvailability(courtId, userId, {
      date: "2026-05-20",
      durationMinutes: 30
    });

    expect(rulesRepository.getEffectivePolicy).toHaveBeenCalledWith({
      priorityGroupId,
      priorityGroupAdvanceBookingDays: 7
    });
    expect(availability.policy).toMatchObject({
      holdMinutes: 5,
      cancelBeforeHours: 4,
      lateCheckinMinutes: 10,
      maxDurationMinutes: 30,
      maxBookingsPerDay: 4,
      advanceBookingDays: 3,
      canJoinWaitlist: false,
      refundRateUserOnTime: 80,
      refundRateManagerFault: 100
    });
  });
});
