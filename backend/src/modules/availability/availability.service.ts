import {
  BookingStatus,
  CourtStatus,
  EntityStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import type {
  AvailabilityQuery,
  AvailabilitySlotDto,
  AvailabilitySlotStatus,
  SlotWindow
} from "./availability.types";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingConflictService,
  type BookingConflictService
} from "./booking-conflict.service";

const courtInclude = {
  courtType: true,
  operatingHours: true,
  pricingRules: {
    where: {
      status: EntityStatus.ACTIVE
    },
    include: {
      priorityGroup: true
    }
  }
} satisfies Prisma.CourtInclude;

type CourtWithAvailabilityRelations = Prisma.CourtGetPayload<{
  include: typeof courtInclude;
}>;
type PricingRule = CourtWithAvailabilityRelations["pricingRules"][number];

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getIsoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes)
  );
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toCourtDto(court: CourtWithAvailabilityRelations) {
  return {
    id: court.courtId,
    courtName: court.courtName,
    location: court.location,
    capacity: court.capacity,
    description: court.description,
    imageUrl: court.imageUrl,
    status: court.status,
    courtType: {
      id: court.courtType.courtTypeId,
      typeName: court.courtType.typeName,
      description: court.courtType.description,
      status: court.courtType.status
    }
  };
}

export class AvailabilityService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly conflicts: BookingConflictService = bookingConflictService,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async getCourtAvailability(courtId: string, viewerUserId: string, query: AvailabilityQuery) {
    const requestedDate = parseDateOnly(query.date);
    const weekday = getIsoWeekday(requestedDate);
    const includePricing = query.includePricing ?? true;
    const now = this.nowProvider();

    const [court, viewer, bookingRule] = await Promise.all([
      this.db.court.findUnique({
        where: { courtId },
        include: courtInclude
      }),
      this.db.user.findUnique({
        where: { userId: viewerUserId },
        include: {
          priorityGroup: true
        }
      }),
      this.db.bookingRule.findFirst({
        where: {
          status: EntityStatus.ACTIVE
        },
        orderBy: [{ updatedAt: "desc" }]
      })
    ]);

    if (!court) {
      throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
    }

    if (!viewer) {
      throw new AppError(401, "Authenticated user no longer exists", "UNAUTHENTICATED");
    }

    const priorityPolicy = viewer.priorityGroupId
      ? await this.db.priorityPolicy.findFirst({
          where: {
            priorityGroupId: viewer.priorityGroupId,
            status: EntityStatus.ACTIVE
          },
          orderBy: [{ updatedAt: "desc" }]
        })
      : null;

    const operatingHour = court.operatingHours.find(
      (hour) => hour.weekday === weekday && hour.status === EntityStatus.ACTIVE
    );
    const slotDurationMinutes = query.durationMinutes ?? operatingHour?.slotDurationMinutes;
    const maxDurationMinutes = priorityPolicy?.maxDurationMinutes ?? bookingRule?.maxDurationMinutes;

    if (query.durationMinutes && maxDurationMinutes && query.durationMinutes > maxDurationMinutes) {
      throw new AppError(
        400,
        "durationMinutes exceeds configured maximum duration",
        "DURATION_EXCEEDS_LIMIT"
      );
    }

    const policy = {
      holdMinutes: bookingRule?.holdMinutes ?? null,
      cancelBeforeHours: bookingRule?.cancelBeforeHours ?? null,
      lateCheckinMinutes: bookingRule?.lateCheckinMinutes ?? null,
      maxDurationMinutes: maxDurationMinutes ?? null,
      maxBookingsPerDay: priorityPolicy?.maxBookingsPerDay ?? bookingRule?.maxBookingsPerDay ?? null,
      advanceBookingDays:
        priorityPolicy?.advanceBookingDays ?? viewer.priorityGroup?.advanceBookingDays ?? null,
      refundRateUserOnTime: bookingRule?.refundRateUserOnTime ?? null,
      refundRateManagerFault: bookingRule?.refundRateManagerFault ?? null
    };

    if (!operatingHour || !slotDurationMinutes) {
      return {
        court: toCourtDto(court),
        date: query.date,
        weekday,
        durationMinutes: query.durationMinutes ?? null,
        policy,
        slots: []
      };
    }

    const dayStart = requestedDate;
    const dayEnd = addDays(dayStart, 1);
    const bookings = await this.db.booking.findMany({
      where: {
        courtId,
        bookingStatus: {
          in: [...ACTIVE_BOOKING_STATUSES]
        },
        startDatetime: {
          lt: dayEnd
        },
        endDatetime: {
          gt: dayStart
        }
      },
      select: {
        bookingId: true,
        bookingStatus: true,
        startDatetime: true,
        endDatetime: true,
        holdExpiresAt: true
      }
    });

    const slots = this.generateSlots(requestedDate, operatingHour, slotDurationMinutes).map((slot) =>
      this.toSlotDto({
        slot,
        court,
        bookings,
        pricingRules: court.pricingRules,
        userPriorityGroupId: viewer.priorityGroupId,
        weekday,
        includePricing,
        now,
        beyondAdvanceWindow: this.isBeyondAdvanceWindow(
          requestedDate,
          policy.advanceBookingDays,
          now
        )
      })
    );

    return {
      court: toCourtDto(court),
      date: query.date,
      weekday,
      durationMinutes: slotDurationMinutes,
      policy,
      slots
    };
  }

  private generateSlots(
    date: Date,
    operatingHour: CourtWithAvailabilityRelations["operatingHours"][number],
    durationMinutes: number
  ): SlotWindow[] {
    const openTime = combineDateAndTime(date, operatingHour.openTime);
    const closeTime = combineDateAndTime(date, operatingHour.closeTime);
    const slots: SlotWindow[] = [];

    for (
      let cursor = openTime;
      addMinutes(cursor, durationMinutes) <= closeTime;
      cursor = addMinutes(cursor, operatingHour.slotDurationMinutes)
    ) {
      slots.push({
        startDatetime: cursor,
        endDatetime: addMinutes(cursor, durationMinutes)
      });
    }

    return slots;
  }

  private toSlotDto(input: {
    slot: SlotWindow;
    court: CourtWithAvailabilityRelations;
    bookings: Array<{
      bookingId: string;
      bookingStatus: BookingStatus;
      startDatetime: Date;
      endDatetime: Date;
      holdExpiresAt: Date | null;
    }>;
    pricingRules: PricingRule[];
    userPriorityGroupId: string | null;
    weekday: number;
    includePricing: boolean;
    now: Date;
    beyondAdvanceWindow: boolean;
  }): AvailabilitySlotDto {
    const priceAmount = input.includePricing
      ? this.resolvePriceAmount(input.slot, input.pricingRules, input.userPriorityGroupId, input.weekday)
      : undefined;

    const baseSlot = {
      startDatetime: input.slot.startDatetime.toISOString(),
      endDatetime: input.slot.endDatetime.toISOString(),
      ...(priceAmount !== undefined ? { priceAmount } : {})
    };

    const courtStatus = this.getCourtUnavailableStatus(input.court.status);
    if (courtStatus) {
      return {
        ...baseSlot,
        status: courtStatus.status,
        unavailableReason: courtStatus.reason
      };
    }

    if (input.beyondAdvanceWindow) {
      return {
        ...baseSlot,
        status: "CLOSED",
        unavailableReason: "Outside advance booking window"
      };
    }

    if (input.slot.endDatetime <= input.now) {
      return {
        ...baseSlot,
        status: "CLOSED",
        unavailableReason: "Slot is in the past"
      };
    }

    const conflict = this.conflicts.findConflict(input.slot, input.bookings, input.now);
    if (conflict) {
      return {
        ...baseSlot,
        status: conflict.status,
        bookingId: conflict.bookingId,
        unavailableReason:
          conflict.status === "HOLD"
            ? "Slot is temporarily held pending payment"
            : "Slot overlaps active booking"
      };
    }

    return {
      ...baseSlot,
      status: "AVAILABLE"
    };
  }

  private getCourtUnavailableStatus(
    courtStatus: CourtStatus
  ): { status: Extract<AvailabilitySlotStatus, "MAINTENANCE" | "CLOSED">; reason: string } | null {
    if (courtStatus === CourtStatus.MAINTENANCE) {
      return {
        status: "MAINTENANCE",
        reason: "Court is under maintenance"
      };
    }

    if (courtStatus === CourtStatus.TEMP_CLOSED || courtStatus === CourtStatus.RETIRED) {
      return {
        status: "CLOSED",
        reason: "Court is closed"
      };
    }

    return null;
  }

  private resolvePriceAmount(
    slot: SlotWindow,
    pricingRules: PricingRule[],
    userPriorityGroupId: string | null,
    weekday: number
  ): number | undefined {
    const slotStartMinutes = slot.startDatetime.getUTCHours() * 60 + slot.startDatetime.getUTCMinutes();
    const slotEndMinutes = slot.endDatetime.getUTCHours() * 60 + slot.endDatetime.getUTCMinutes();

    const matchingRules = pricingRules.filter((rule) => {
      const ruleStartMinutes = minutesFromTime(rule.startTime);
      const ruleEndMinutes = minutesFromTime(rule.endTime);
      const appliesToDay = rule.applicableDay === null || rule.applicableDay === weekday;
      const appliesToPriority =
        rule.priorityGroupId === null || rule.priorityGroupId === userPriorityGroupId;
      const appliesToEffectiveDate =
        (!rule.effectiveFrom || rule.effectiveFrom <= slot.startDatetime) &&
        (!rule.effectiveTo || rule.effectiveTo >= slot.startDatetime);

      return (
        appliesToDay &&
        appliesToPriority &&
        appliesToEffectiveDate &&
        ruleStartMinutes <= slotStartMinutes &&
        ruleEndMinutes >= slotEndMinutes
      );
    });

    const userSpecificRule = matchingRules.find((rule) => rule.priorityGroupId === userPriorityGroupId);
    const selectedRule = userSpecificRule ?? matchingRules.find((rule) => rule.priorityGroupId === null);

    return selectedRule ? Number(selectedRule.priceAmount.toString()) : undefined;
  }

  private isBeyondAdvanceWindow(
    requestedDate: Date,
    advanceBookingDays: number | null,
    now: Date
  ): boolean {
    if (advanceBookingDays === null) {
      return false;
    }

    const today = startOfUtcDay(now);
    return requestedDate > addDays(today, advanceBookingDays);
  }
}

export const availabilityService = new AvailabilityService();
