import {
  AccountStatus,
  BookingPermissionStatus,
  BookingStatus,
  CourtStatus,
  EntityStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  PrismaClient,
  WaitlistStatus
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingConflictService,
  type BookingConflictService
} from "../availability/booking-conflict.service";
import { bookingStateService, type BookingStateService } from "../bookings/booking-state.service";
import {
  notificationsService,
  type NotificationsService
} from "../notifications/notifications.service";
import { RulesRepository } from "../rules/rules.repository";
import type {
  JoinWaitlistInput,
  ListMyWaitlistQuery,
  NotifyNextForSlotInput
} from "./waitlist.types";

const activeWaitlistStatuses: WaitlistStatus[] = [
  WaitlistStatus.WAITING,
  WaitlistStatus.NOTIFIED
];

const waitlistEntryInclude = {
  court: {
    include: {
      courtType: true
    }
  },
  priorityGroup: true
} satisfies Prisma.WaitlistEntryInclude;

const courtWaitlistInclude = {
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

const waitlistEntryForBookingInclude = {
  user: {
    include: {
      priorityGroup: true
    }
  },
  court: {
    include: courtWaitlistInclude
  },
  priorityGroup: true
} satisfies Prisma.WaitlistEntryInclude;

const bookingOrderForWaitlistInclude = {
  items: {
    include: {
      court: {
        select: {
          courtId: true,
          courtName: true,
          status: true
        }
      }
    },
    orderBy: {
      startDatetime: "asc" as const
    }
  }
} satisfies Prisma.BookingOrderInclude;

type WaitlistEntryWithRelations = Prisma.WaitlistEntryGetPayload<{
  include: typeof waitlistEntryInclude;
}>;
type WaitlistEntryForBooking = Prisma.WaitlistEntryGetPayload<{
  include: typeof waitlistEntryForBookingInclude;
}>;
type BookingOrderForWaitlist = Prisma.BookingOrderGetPayload<{
  include: typeof bookingOrderForWaitlistInclude;
}>;
type CourtForWaitlist = Prisma.CourtGetPayload<{ include: typeof courtWaitlistInclude }>;
type PricingRuleForWaitlist = CourtForWaitlist["pricingRules"][number];
type OperatingHourForWaitlist = CourtForWaitlist["operatingHours"][number];
type UserForWaitlist = WaitlistEntryForBooking["user"];
type WaitlistDbClient = PrismaClient | Prisma.TransactionClient;

type ExpireNotifiedEntriesInput = {
  now?: Date;
  batchSize?: number;
};

type ExpireNotifiedEntriesResult = {
  processed: number;
};

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function minutesBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 60_000);
}

function getIsoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function utcMinutesFromDate(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function defaultBookingCode(now: Date): string {
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${datePart}-${randomPart}`;
}

function toWaitlistEntryDto(entry: WaitlistEntryWithRelations) {
  return {
    id: entry.waitlistEntryId,
    waitlistEntryId: entry.waitlistEntryId,
    userId: entry.userId,
    court: {
      id: entry.court.courtId,
      courtId: entry.court.courtId,
      courtName: entry.court.courtName,
      status: entry.court.status,
      courtType: {
        id: entry.court.courtType.courtTypeId,
        courtTypeId: entry.court.courtType.courtTypeId,
        typeName: entry.court.courtType.typeName
      }
    },
    priorityGroup: entry.priorityGroup
      ? {
          id: entry.priorityGroup.priorityGroupId,
          priorityGroupId: entry.priorityGroup.priorityGroupId,
          groupCode: entry.priorityGroup.groupCode,
          groupName: entry.priorityGroup.groupName,
          priorityLevel: entry.priorityGroup.priorityLevel
        }
      : null,
    desiredStartDatetime: entry.desiredStartDatetime,
    desiredEndDatetime: entry.desiredEndDatetime,
    priorityOrder: entry.priorityOrder,
    status: entry.status,
    registeredAt: entry.registeredAt,
    notifiedAt: entry.notifiedAt,
    expiresAt: entry.expiresAt
  };
}

function toBookingHoldDto(order: BookingOrderForWaitlist) {
  return {
    id: order.bookingOrderId,
    bookingOrderId: order.bookingOrderId,
    bookingCode: order.bookingCode,
    orderStatus: order.bookingStatus,
    bookingStatus: order.bookingStatus,
    paymentStatus: order.paymentStatus,
    holdExpiresAt: order.holdExpiresAt,
    totalAmount: decimalToNumber(order.totalAmount),
    items: order.items.map((item) => ({
      id: item.bookingItemId,
      bookingItemId: item.bookingItemId,
      courtId: item.courtId,
      court: {
        id: item.court.courtId,
        courtName: item.court.courtName,
        status: item.court.status
      },
      startDatetime: item.startDatetime,
      endDatetime: item.endDatetime,
      itemStatus: item.bookingStatus,
      bookingStatus: item.bookingStatus,
      unitPrice: decimalToNumber(item.unitPrice),
      amount: decimalToNumber(item.amount)
    }))
  };
}

function handleKnownPrismaError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("no_overlapping_active_booking_items")) {
    throw new AppError(
      409,
      "This slot was just held or booked by someone else. Please join the waitlist again.",
      "WAITLIST_SLOT_TAKEN"
    );
  }

  if (message.includes("waitlist_entries_active_unique_idx")) {
    throw new AppError(409, "Active waitlist entry already exists", "WAITLIST_ALREADY_EXISTS");
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "Active waitlist entry already exists", "WAITLIST_ALREADY_EXISTS");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2034") {
      throw new AppError(409, "Waitlist transaction conflicted, please retry", "WAITLIST_RETRY_REQUIRED");
    }
  }

  throw error;
}

export class WaitlistService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly conflicts: BookingConflictService = bookingConflictService,
    private readonly state: BookingStateService = bookingStateService,
    private readonly notifications: NotificationsService = notificationsService,
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly codeGenerator: (now: Date) => string = defaultBookingCode
  ) {}

  async joinWaitlist(userId: string, input: JoinWaitlistInput) {
    const now = this.nowProvider();

    try {
      const entry = await this.db.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { userId },
            include: { priorityGroup: true }
          });

          if (!user) {
            throw new AppError(401, "Authenticated user no longer exists", "UNAUTHENTICATED");
          }

          this.assertUserCanUseWaitlist(user, now);

          const policy = await new RulesRepository(tx).getEffectivePolicy({
            priorityGroupId: user.priorityGroupId,
            priorityGroupAdvanceBookingDays: user.priorityGroup?.advanceBookingDays ?? null
          });

          if (!policy.canJoinWaitlist) {
            throw new AppError(403, "Priority group cannot join waitlist", "WAITLIST_NOT_ALLOWED");
          }

          const court = await this.getCourtOrThrow(tx, input.courtId);
          this.validateRequestedSlot({
            court,
            startDatetime: input.startDatetime,
            endDatetime: input.endDatetime,
            now,
            maxDurationMinutes: policy.maxDurationMinutes,
            advanceBookingDays: policy.advanceBookingDays
          });
          await this.state.expireOverlappingPaymentHolds(tx, {
            courtId: input.courtId,
            startDatetime: input.startDatetime,
            endDatetime: input.endDatetime,
            now
          });

          const conflict = await this.findActiveConflict(
            tx,
            input.courtId,
            input.startDatetime,
            input.endDatetime,
            now
          );

          if (!conflict) {
            throw new AppError(
              409,
              "Slot is available; please create a booking directly",
              "WAITLIST_SLOT_AVAILABLE"
            );
          }

          await this.assertNoActiveDuplicate(tx, userId, input);
          const priorityOrder = await this.resolvePriorityOrder(tx, user);

          const createdEntry = await tx.waitlistEntry.create({
            data: {
              userId,
              courtId: input.courtId,
              priorityGroupId: user.priorityGroupId,
              desiredStartDatetime: input.startDatetime,
              desiredEndDatetime: input.endDatetime,
              priorityOrder,
              status: WaitlistStatus.WAITING,
              registeredAt: now
            },
            include: waitlistEntryInclude
          });

          return createdEntry;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toWaitlistEntryDto(entry);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async getMyWaitlist(userId: string, query: ListMyWaitlistQuery) {
    const entries = await this.db.waitlistEntry.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.fromDate || query.toDate
          ? {
              desiredStartDatetime: {
                ...(query.fromDate ? { gte: query.fromDate } : {}),
                ...(query.toDate ? { lte: query.toDate } : {})
              }
            }
          : {})
      },
      include: waitlistEntryInclude,
      orderBy: [{ registeredAt: "desc" }]
    });

    return entries.map(toWaitlistEntryDto);
  }

  async cancelWaitlist(userId: string, waitlistEntryId: string) {
    const entry = await this.db.waitlistEntry.findFirst({
      where: {
        waitlistEntryId,
        userId
      },
      include: waitlistEntryInclude
    });

    if (!entry) {
      throw new AppError(404, "Waitlist entry not found", "WAITLIST_ENTRY_NOT_FOUND");
    }

    if (entry.status === WaitlistStatus.CANCELLED) {
      return toWaitlistEntryDto(entry);
    }

    if (entry.status === WaitlistStatus.BOOKED || entry.status === WaitlistStatus.EXPIRED) {
      throw new AppError(
        409,
        "Waitlist entry cannot be cancelled in its current status",
        "WAITLIST_CANCEL_NOT_ALLOWED"
      );
    }

    const updatedEntry = await this.db.waitlistEntry.update({
      where: { waitlistEntryId },
      data: {
        status: WaitlistStatus.CANCELLED
      },
      include: waitlistEntryInclude
    });

    return toWaitlistEntryDto(updatedEntry);
  }

  async notifyNextForSlot(input: NotifyNextForSlotInput) {
    const now = this.nowProvider();

    try {
      const entry = await this.db.$transaction(
        async (tx) => this.notifyNextForSlotInTransaction(tx, input, now),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return entry ? toWaitlistEntryDto(entry) : null;
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async notifyNextForSlotInTransaction(
    tx: Prisma.TransactionClient,
    input: NotifyNextForSlotInput,
    now: Date = this.nowProvider()
  ): Promise<WaitlistEntryWithRelations | null> {
    const conflict = await this.findActiveConflict(
      tx,
      input.courtId,
      input.startDatetime,
      input.endDatetime,
      now
    );

    if (conflict) {
      return null;
    }

    const candidate = await tx.waitlistEntry.findFirst({
      where: {
        courtId: input.courtId,
        desiredStartDatetime: input.startDatetime,
        desiredEndDatetime: input.endDatetime,
        status: WaitlistStatus.WAITING
      },
      orderBy: [{ priorityOrder: "asc" }, { registeredAt: "asc" }],
      include: waitlistEntryInclude
    });

    if (!candidate) {
      return null;
    }

    const responseMinutes = await new RulesRepository(tx).getWaitlistResponseMinutes();
    const expiresAt = addMinutes(now, responseMinutes);
    const updated = await tx.waitlistEntry.updateMany({
      where: {
        waitlistEntryId: candidate.waitlistEntryId,
        status: WaitlistStatus.WAITING
      },
      data: {
        status: WaitlistStatus.NOTIFIED,
        notifiedAt: now,
        expiresAt
      }
    });

    if (updated.count === 0) {
      return null;
    }

    await this.notifications.createWaitlistNotification(tx, {
      userId: candidate.userId,
      notificationType: NotificationType.WAITLIST_NOTIFIED,
      title: "Waitlist slot available",
      content: `The slot you are waiting for is available. You have ${responseMinutes} minutes to confirm booking.`,
      dedupe: false
    });

    return tx.waitlistEntry.findUniqueOrThrow({
      where: { waitlistEntryId: candidate.waitlistEntryId },
      include: waitlistEntryInclude
    });
  }

  async bookFromWaitlist(userId: string, input: { waitlistEntryId: string }) {
    const now = this.nowProvider();

    try {
      const order = await this.db.$transaction(
        async (tx) => {
          const entry = await tx.waitlistEntry.findFirst({
            where: {
              waitlistEntryId: input.waitlistEntryId,
              userId
            },
            include: waitlistEntryForBookingInclude
          });

          if (!entry) {
            throw new AppError(404, "Waitlist entry not found", "WAITLIST_ENTRY_NOT_FOUND");
          }

          this.assertWaitlistCanBeBooked(entry, now);
          this.assertUserCanUseWaitlist(entry.user, now);

          const policy = await new RulesRepository(tx).getEffectivePolicy({
            priorityGroupId: entry.user.priorityGroupId,
            priorityGroupAdvanceBookingDays: entry.user.priorityGroup?.advanceBookingDays ?? null
          });
          const operatingHour = this.validateRequestedSlot({
            court: entry.court,
            startDatetime: entry.desiredStartDatetime,
            endDatetime: entry.desiredEndDatetime,
            now,
            maxDurationMinutes: policy.maxDurationMinutes,
            advanceBookingDays: policy.advanceBookingDays
          });

          await this.assertDailyQuotaAvailable(tx, userId, entry.desiredStartDatetime, now, policy.maxBookingsPerDay);
          await this.state.expireOverlappingPaymentHolds(tx, {
            courtId: entry.courtId,
            startDatetime: entry.desiredStartDatetime,
            endDatetime: entry.desiredEndDatetime,
            now
          });
          await this.assertSlotAvailableForBooking(tx, {
            courtId: entry.courtId,
            startDatetime: entry.desiredStartDatetime,
            endDatetime: entry.desiredEndDatetime,
            now
          });

          const waitlistUpdate = await tx.waitlistEntry.updateMany({
            where: {
              waitlistEntryId: entry.waitlistEntryId,
              userId,
              status: WaitlistStatus.NOTIFIED,
              expiresAt: {
                gt: now
              }
            },
            data: {
              status: WaitlistStatus.BOOKED
            }
          });

          if (waitlistUpdate.count === 0) {
            throw new AppError(
              409,
              "Waitlist entry can no longer be booked",
              "WAITLIST_BOOKING_NOT_ALLOWED"
            );
          }

          const pricing = this.calculateItemAmount({
            startDatetime: entry.desiredStartDatetime,
            endDatetime: entry.desiredEndDatetime,
            slotDurationMinutes: operatingHour.slotDurationMinutes,
            pricingRules: entry.court.pricingRules,
            userPriorityGroupId: entry.user.priorityGroupId,
            weekday: getIsoWeekday(entry.desiredStartDatetime)
          });
          const createdOrder = await tx.bookingOrder.create({
            data: {
              bookingCode: this.codeGenerator(now),
              userId,
              totalAmount: pricing.amount,
              bookingStatus: BookingStatus.PENDING_PAYMENT,
              paymentStatus: PaymentStatus.INITIATED,
              holdExpiresAt: addMinutes(now, policy.holdMinutes),
              refundable: true,
              note: "Created from waitlist notification",
              items: {
                create: [
                  {
                    courtId: entry.courtId,
                    startDatetime: entry.desiredStartDatetime,
                    endDatetime: entry.desiredEndDatetime,
                    unitPrice: pricing.unitPrice,
                    amount: pricing.amount,
                    bookingStatus: BookingStatus.PENDING_PAYMENT
                  }
                ]
              }
            },
            select: {
              bookingOrderId: true,
              bookingCode: true
            }
          });
          const createdItem = await tx.bookingItem.findFirstOrThrow({
            where: { bookingOrderId: createdOrder.bookingOrderId },
            select: { bookingItemId: true }
          });

          await this.state.recordOrderStatusHistory(tx, {
            bookingOrderId: createdOrder.bookingOrderId,
            oldStatus: null,
            newStatus: BookingStatus.PENDING_PAYMENT,
            actionType: "USER_CREATE_BOOKING_ORDER_FROM_WAITLIST",
            actionByUserId: userId,
            note: "Booking order hold created from waitlist pending full payment"
          });
          await this.state.recordItemStatusHistory(tx, {
            bookingItemId: createdItem.bookingItemId,
            oldStatus: null,
            newStatus: BookingStatus.PENDING_PAYMENT,
            actionType: "USER_CREATE_BOOKING_ITEM_FROM_WAITLIST",
            actionByUserId: userId,
            note: "Booking item hold created from waitlist pending full payment"
          });
          await this.notifications.createBookingNotification(tx, {
            userId,
            bookingOrderId: createdOrder.bookingOrderId,
            notificationType: NotificationType.BOOKING_CREATED,
            title: "Booking hold created",
            content: `Booking ${createdOrder.bookingCode} is pending full payment.`
          });

          return tx.bookingOrder.findUniqueOrThrow({
            where: { bookingOrderId: createdOrder.bookingOrderId },
            include: bookingOrderForWaitlistInclude
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toBookingHoldDto(order);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async expireNotifiedEntries(
    input: ExpireNotifiedEntriesInput = {}
  ): Promise<ExpireNotifiedEntriesResult> {
    const now = input.now ?? this.nowProvider();
    const entries = await this.db.waitlistEntry.findMany({
      where: this.expirableWaitlistWhere(now),
      select: {
        waitlistEntryId: true
      },
      orderBy: [{ expiresAt: "asc" }],
      take: input.batchSize ?? 100
    });
    let processed = 0;

    for (const entry of entries) {
      const expired = await this.db.$transaction(
        async (tx) => this.expireNotifiedEntryInTransaction(tx, entry.waitlistEntryId, now),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      if (expired) {
        processed += 1;
      }
    }

    return { processed };
  }

  private expirableWaitlistWhere(now: Date): Prisma.WaitlistEntryWhereInput {
    return {
      status: WaitlistStatus.NOTIFIED,
      expiresAt: {
        lt: now
      }
    };
  }

  private async expireNotifiedEntryInTransaction(
    tx: Prisma.TransactionClient,
    waitlistEntryId: string,
    now: Date
  ): Promise<boolean> {
    const currentEntry = await tx.waitlistEntry.findFirst({
      where: {
        waitlistEntryId,
        ...this.expirableWaitlistWhere(now)
      },
      select: {
        waitlistEntryId: true,
        userId: true,
        courtId: true,
        desiredStartDatetime: true,
        desiredEndDatetime: true,
        status: true,
        expiresAt: true
      }
    });

    if (!currentEntry) {
      return false;
    }

    const updatedEntry = await tx.waitlistEntry.updateMany({
      where: {
        waitlistEntryId: currentEntry.waitlistEntryId,
        ...this.expirableWaitlistWhere(now)
      },
      data: {
        status: WaitlistStatus.EXPIRED
      }
    });

    if (updatedEntry.count === 0) {
      return false;
    }

    await this.notifications.createWaitlistNotification(tx, {
      userId: currentEntry.userId,
      notificationType: NotificationType.WAITLIST_EXPIRED,
      title: "Waitlist response expired",
      content:
        "Your waitlist response window has expired. You can join the waitlist again if you still need the slot.",
      dedupe: false
    });
    await tx.auditLog.create({
      data: {
        actorUserId: null,
        entityType: "WAITLIST_ENTRY",
        entityId: currentEntry.waitlistEntryId,
        action: "AUTO_EXPIRE_WAITLIST_ENTRY",
        oldValue: jsonSafe({
          status: currentEntry.status,
          expiresAt: currentEntry.expiresAt
        }),
        newValue: jsonSafe({
          status: WaitlistStatus.EXPIRED
        })
      }
    });
    await this.notifyNextForSlotInTransaction(
      tx,
      {
        courtId: currentEntry.courtId,
        startDatetime: currentEntry.desiredStartDatetime,
        endDatetime: currentEntry.desiredEndDatetime
      },
      now
    );

    return true;
  }

  private async getCourtOrThrow(
    db: WaitlistDbClient,
    courtId: string
  ): Promise<CourtForWaitlist> {
    const court = await db.court.findUnique({
      where: { courtId },
      include: courtWaitlistInclude
    });

    if (!court) {
      throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
    }

    return court;
  }

  private assertUserCanUseWaitlist(user: UserForWaitlist, now: Date): void {
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new AppError(403, "Account must be active to use waitlist", "ACCOUNT_NOT_ACTIVE");
    }

    if (user.bookingPermissionStatus !== BookingPermissionStatus.ALLOWED) {
      throw new AppError(403, "Booking permission is restricted", "BOOKING_PERMISSION_RESTRICTED");
    }

    if (user.bookingLockedUntil && user.bookingLockedUntil > now) {
      throw new AppError(
        403,
        "Booking permission is temporarily locked",
        "BOOKING_PERMISSION_LOCKED"
      );
    }
  }

  private validateRequestedSlot(input: {
    court: CourtForWaitlist;
    startDatetime: Date;
    endDatetime: Date;
    now: Date;
    maxDurationMinutes: number;
    advanceBookingDays: number | null;
  }): OperatingHourForWaitlist {
    this.assertBookingWindow(input.startDatetime, input.endDatetime, input.now);
    this.assertCourtCanUseWaitlist(input.court);
    const operatingHour = this.getOperatingHourOrThrow(input.court, input.startDatetime);

    this.assertWithinOperatingHours(input.startDatetime, input.endDatetime, operatingHour);
    this.assertSlotAligned(input.startDatetime, input.endDatetime, operatingHour);
    this.assertDurationAllowed(input.startDatetime, input.endDatetime, input.maxDurationMinutes);
    this.assertAdvanceBookingAllowed(input.startDatetime, input.advanceBookingDays, input.now);

    return operatingHour;
  }

  private assertBookingWindow(startDatetime: Date, endDatetime: Date, now: Date): void {
    if (startDatetime >= endDatetime) {
      throw new AppError(400, "startDatetime must be earlier than endDatetime", "INVALID_WAITLIST_TIME");
    }

    if (startDatetime <= now) {
      throw new AppError(400, "Cannot join waitlist for a past slot", "WAITLIST_IN_PAST");
    }
  }

  private assertCourtCanUseWaitlist(court: CourtForWaitlist): void {
    if (court.status !== CourtStatus.ACTIVE) {
      throw new AppError(409, "Court is not active", "COURT_NOT_AVAILABLE");
    }
  }

  private getOperatingHourOrThrow(court: CourtForWaitlist, startDatetime: Date): OperatingHourForWaitlist {
    const weekday = getIsoWeekday(startDatetime);
    const operatingHour = court.operatingHours.find(
      (hour) => hour.weekday === weekday && hour.status === EntityStatus.ACTIVE
    );

    if (!operatingHour) {
      throw new AppError(400, "Court is closed on the requested day", "COURT_CLOSED");
    }

    return operatingHour;
  }

  private assertWithinOperatingHours(
    startDatetime: Date,
    endDatetime: Date,
    operatingHour: OperatingHourForWaitlist
  ): void {
    const startMinutes = utcMinutesFromDate(startDatetime);
    const endMinutes = utcMinutesFromDate(endDatetime);
    const openMinutes = minutesFromTime(operatingHour.openTime);
    const closeMinutes = minutesFromTime(operatingHour.closeTime);

    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      throw new AppError(400, "Waitlist slot must be within court operating hours", "OUTSIDE_OPERATING_HOURS");
    }
  }

  private assertSlotAligned(
    startDatetime: Date,
    endDatetime: Date,
    operatingHour: OperatingHourForWaitlist
  ): void {
    const startOffset = utcMinutesFromDate(startDatetime) - minutesFromTime(operatingHour.openTime);
    const durationMinutes = minutesBetween(startDatetime, endDatetime);

    if (
      startOffset < 0 ||
      startOffset % operatingHour.slotDurationMinutes !== 0 ||
      durationMinutes % operatingHour.slotDurationMinutes !== 0
    ) {
      throw new AppError(
        400,
        "Waitlist time must align with the court slot duration",
        "WAITLIST_TIME_NOT_ALIGNED"
      );
    }
  }

  private assertDurationAllowed(
    startDatetime: Date,
    endDatetime: Date,
    maxDurationMinutes: number
  ): void {
    if (minutesBetween(startDatetime, endDatetime) > maxDurationMinutes) {
      throw new AppError(
        400,
        "Waitlist duration exceeds configured maximum duration",
        "WAITLIST_DURATION_EXCEEDS_LIMIT"
      );
    }
  }

  private assertAdvanceBookingAllowed(
    startDatetime: Date,
    advanceBookingDays: number | null,
    now: Date
  ): void {
    if (advanceBookingDays === null) {
      return;
    }

    const today = startOfUtcDay(now);
    if (startOfUtcDay(startDatetime) > addDays(today, advanceBookingDays)) {
      throw new AppError(
        400,
        "Waitlist slot is outside the user's advance booking window",
        "ADVANCE_BOOKING_LIMIT_EXCEEDED"
      );
    }
  }

  private async assertNoActiveDuplicate(
    tx: Prisma.TransactionClient,
    userId: string,
    input: JoinWaitlistInput
  ): Promise<void> {
    const duplicate = await tx.waitlistEntry.findFirst({
      where: {
        userId,
        courtId: input.courtId,
        desiredStartDatetime: input.startDatetime,
        desiredEndDatetime: input.endDatetime,
        status: {
          in: activeWaitlistStatuses
        }
      },
      select: {
        waitlistEntryId: true
      }
    });

    if (duplicate) {
      throw new AppError(409, "Active waitlist entry already exists", "WAITLIST_ALREADY_EXISTS");
    }
  }

  private async resolvePriorityOrder(
    tx: Prisma.TransactionClient,
    user: UserForWaitlist
  ): Promise<number> {
    const policy = await new RulesRepository(tx).getPriorityPolicyByGroupId(user.priorityGroupId);

    return policy?.priorityLevel ?? user.priorityGroup?.priorityLevel ?? 9999;
  }

  private async findActiveConflict(
    db: WaitlistDbClient,
    courtId: string,
    startDatetime: Date,
    endDatetime: Date,
    now: Date
  ) {
    const existingItems = await db.bookingItem.findMany({
      where: {
        courtId,
        bookingStatus: {
          in: [...ACTIVE_BOOKING_STATUSES]
        },
        startDatetime: {
          lt: endDatetime
        },
        endDatetime: {
          gt: startDatetime
        }
      },
      select: {
        bookingItemId: true,
        bookingOrderId: true,
        bookingStatus: true,
        startDatetime: true,
        endDatetime: true,
        bookingOrder: {
          select: {
            holdExpiresAt: true
          }
        }
      }
    });

    return this.conflicts.findConflict(
      { startDatetime, endDatetime },
      existingItems.map((item) => ({
        bookingItemId: item.bookingItemId,
        bookingOrderId: item.bookingOrderId,
        bookingStatus: item.bookingStatus,
        startDatetime: item.startDatetime,
        endDatetime: item.endDatetime,
        holdExpiresAt: item.bookingOrder.holdExpiresAt
      })),
      now
    );
  }

  private async assertSlotAvailableForBooking(
    tx: Prisma.TransactionClient,
    input: {
      courtId: string;
      startDatetime: Date;
      endDatetime: Date;
      now: Date;
    }
  ): Promise<void> {
    const conflict = await this.findActiveConflict(
      tx,
      input.courtId,
      input.startDatetime,
      input.endDatetime,
      input.now
    );

    if (conflict) {
      throw new AppError(
        409,
        "This slot was just held or booked by someone else. Please join the waitlist again.",
        "WAITLIST_SLOT_TAKEN"
      );
    }
  }

  private async assertDailyQuotaAvailable(
    tx: Prisma.TransactionClient,
    userId: string,
    startDatetime: Date,
    now: Date,
    maxBookingsPerDay: number
  ): Promise<void> {
    const dayStart = startOfUtcDay(startDatetime);
    const dayEnd = addDays(dayStart, 1);
    const existingCount = await tx.bookingOrder.count({
      where: {
        userId,
        items: {
          some: {
            startDatetime: {
              gte: dayStart,
              lt: dayEnd
            }
          }
        },
        OR: [
          {
            bookingStatus: {
              in: [
                BookingStatus.PAYMENT_PROCESSING,
                BookingStatus.CONFIRMED,
                BookingStatus.IN_USE
              ]
            }
          },
          {
            bookingStatus: BookingStatus.PENDING_PAYMENT,
            holdExpiresAt: {
              gt: now
            }
          }
        ]
      }
    });

    if (existingCount >= maxBookingsPerDay) {
      throw new AppError(
        409,
        "User has reached the maximum bookings per day",
        "MAX_BOOKINGS_PER_DAY_REACHED"
      );
    }
  }

  private assertWaitlistCanBeBooked(entry: WaitlistEntryForBooking, now: Date): void {
    if (entry.status === WaitlistStatus.WAITING) {
      throw new AppError(409, "Waitlist entry has not been notified", "WAITLIST_ENTRY_NOT_NOTIFIED");
    }

    if (entry.status === WaitlistStatus.EXPIRED || (entry.expiresAt && entry.expiresAt <= now)) {
      throw new AppError(409, "Waitlist entry has expired", "WAITLIST_ENTRY_EXPIRED");
    }

    if (entry.status === WaitlistStatus.CANCELLED) {
      throw new AppError(409, "Waitlist entry was cancelled", "WAITLIST_ENTRY_CANCELLED");
    }

    if (entry.status === WaitlistStatus.BOOKED) {
      throw new AppError(409, "Waitlist entry was already booked", "WAITLIST_ENTRY_ALREADY_BOOKED");
    }

    if (entry.status !== WaitlistStatus.NOTIFIED) {
      throw new AppError(
        409,
        "Waitlist entry cannot be booked in its current status",
        "WAITLIST_BOOKING_NOT_ALLOWED"
      );
    }

    if (!entry.expiresAt) {
      throw new AppError(409, "Waitlist entry has no response window", "WAITLIST_ENTRY_EXPIRED");
    }
  }

  private calculateItemAmount(input: {
    startDatetime: Date;
    endDatetime: Date;
    slotDurationMinutes: number;
    pricingRules: PricingRuleForWaitlist[];
    userPriorityGroupId: string | null;
    weekday: number;
  }): { unitPrice: Prisma.Decimal; amount: Prisma.Decimal } {
    let amount = new Prisma.Decimal(0);
    let unitPrice: Prisma.Decimal | null = null;

    for (
      let cursor = input.startDatetime;
      cursor < input.endDatetime;
      cursor = addMinutes(cursor, input.slotDurationMinutes)
    ) {
      const segmentEnd = addMinutes(cursor, input.slotDurationMinutes);
      if (segmentEnd > input.endDatetime) {
        throw new AppError(
          400,
          "Waitlist booking duration must align with configured slot duration",
          "WAITLIST_TIME_NOT_ALIGNED"
        );
      }

      const priceRule = this.resolvePricingRule({
        startDatetime: cursor,
        endDatetime: segmentEnd,
        pricingRules: input.pricingRules,
        userPriorityGroupId: input.userPriorityGroupId,
        weekday: input.weekday
      });

      unitPrice ??= priceRule.priceAmount;
      amount = amount.add(priceRule.priceAmount);
    }

    if (!unitPrice) {
      throw new AppError(400, "No pricing rule covers the requested slot", "PRICING_RULE_NOT_FOUND");
    }

    return { unitPrice, amount };
  }

  private resolvePricingRule(input: {
    startDatetime: Date;
    endDatetime: Date;
    pricingRules: PricingRuleForWaitlist[];
    userPriorityGroupId: string | null;
    weekday: number;
  }): PricingRuleForWaitlist {
    const slotStartMinutes = utcMinutesFromDate(input.startDatetime);
    const slotEndMinutes = utcMinutesFromDate(input.endDatetime);
    const matchingRules = input.pricingRules.filter((rule) => {
      const ruleStartMinutes = minutesFromTime(rule.startTime);
      const ruleEndMinutes = minutesFromTime(rule.endTime);
      const appliesToDay = rule.applicableDay === null || rule.applicableDay === input.weekday;
      const appliesToPriority =
        rule.priorityGroupId === null || rule.priorityGroupId === input.userPriorityGroupId;
      const appliesToEffectiveDate =
        (!rule.effectiveFrom || rule.effectiveFrom <= input.startDatetime) &&
        (!rule.effectiveTo || rule.effectiveTo >= input.startDatetime);

      return (
        appliesToDay &&
        appliesToPriority &&
        appliesToEffectiveDate &&
        ruleStartMinutes <= slotStartMinutes &&
        ruleEndMinutes >= slotEndMinutes
      );
    });
    const userSpecificRule = matchingRules.find(
      (rule) => rule.priorityGroupId === input.userPriorityGroupId
    );
    const selectedRule = userSpecificRule ?? matchingRules.find((rule) => rule.priorityGroupId === null);

    if (!selectedRule) {
      throw new AppError(400, "No pricing rule covers the requested slot", "PRICING_RULE_NOT_FOUND");
    }

    return selectedRule;
  }
}

export const waitlistService = new WaitlistService();
