import {
  AccountStatus,
  BookingPermissionStatus,
  BookingStatus,
  CourtStatus,
  EntityStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RefundStatus
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingConflictService,
  type BookingConflictService
} from "../availability/booking-conflict.service";
import { RulesRepository, rulesRepository } from "../rules/rules.repository";
import type {
  CancelBookingInput,
  CreateBookingInput,
  ListMyBookingsQuery
} from "./bookings.types";
import { bookingStateService, type BookingStateService } from "./booking-state.service";

const bookingInclude = {
  user: {
    select: {
      userId: true,
      fullName: true,
      email: true
    }
  },
  court: {
    include: {
      courtType: true
    }
  },
  bookingStatusHistories: {
    include: {
      actionBy: {
        select: {
          userId: true,
          fullName: true,
          email: true
        }
      }
    },
    orderBy: {
      changedAt: "asc" as const
    }
  },
  payments: {
    orderBy: {
      createdAt: "desc" as const
    }
  },
  refunds: {
    orderBy: {
      requestedAt: "desc" as const
    }
  }
} satisfies Prisma.BookingInclude;

const courtBookingInclude = {
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

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;
type CourtForBooking = Prisma.CourtGetPayload<{ include: typeof courtBookingInclude }>;
type PricingRuleForBooking = CourtForBooking["pricingRules"][number];
type OperatingHourForBooking = CourtForBooking["operatingHours"][number];
type UserForBooking = Prisma.UserGetPayload<{ include: { priorityGroup: true } }>;
type BookingDbClient = PrismaClient | Prisma.TransactionClient;

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

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toBookingDto(booking: BookingWithRelations) {
  return {
    id: booking.bookingId,
    bookingCode: booking.bookingCode,
    user: {
      id: booking.user.userId,
      fullName: booking.user.fullName,
      email: booking.user.email
    },
    court: {
      id: booking.court.courtId,
      courtName: booking.court.courtName,
      location: booking.court.location,
      capacity: booking.court.capacity,
      status: booking.court.status,
      courtType: {
        id: booking.court.courtType.courtTypeId,
        typeName: booking.court.courtType.typeName
      }
    },
    startDatetime: booking.startDatetime,
    endDatetime: booking.endDatetime,
    participantCount: booking.participantCount,
    usagePurpose: booking.usagePurpose,
    totalAmount: decimalToNumber(booking.totalAmount),
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    refundable: booking.refundable,
    holdExpiresAt: booking.holdExpiresAt,
    cancelReason: booking.cancelReason,
    cancelledAt: booking.cancelledAt,
    checkedInByUserId: booking.checkedInByUserId,
    completedByUserId: booking.completedByUserId,
    noShowMarkedByUserId: booking.noShowMarkedByUserId,
    noRefundReason: booking.noRefundReason,
    checkinTime: booking.checkinTime,
    checkoutTime: booking.checkoutTime,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    statusHistories: booking.bookingStatusHistories.map((history) => ({
      id: history.bookingStatusHistoryId,
      oldStatus: history.oldStatus,
      newStatus: history.newStatus,
      actionType: history.actionType,
      note: history.note,
      changedAt: history.changedAt,
      actionByUser: history.actionBy
        ? {
            id: history.actionBy.userId,
            fullName: history.actionBy.fullName,
            email: history.actionBy.email
          }
        : null
    })),
    payments: booking.payments.map((payment) => ({
      id: payment.paymentId,
      amount: decimalToNumber(payment.amount),
      paymentMethod: payment.paymentMethod,
      gatewayTransactionId: payment.gatewayTransactionId,
      paymentStatus: payment.paymentStatus,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt
    })),
    refunds: booking.refunds.map((refund) => ({
      id: refund.refundId,
      paymentId: refund.paymentId,
      refundAmount: decimalToNumber(refund.refundAmount),
      refundReason: refund.refundReason,
      refundStatus: refund.refundStatus,
      requestedAt: refund.requestedAt,
      processedAt: refund.processedAt
    }))
  };
}

function handleKnownPrismaError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("no_overlapping_active_bookings")) {
    throw new AppError(409, "Selected slot is no longer available", "BOOKING_SLOT_UNAVAILABLE");
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "Resource already exists", "UNIQUE_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2034") {
      throw new AppError(409, "Booking transaction conflicted, please retry", "BOOKING_RETRY_REQUIRED");
    }
  }

  throw error;
}

export class BookingsService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly conflicts: BookingConflictService = bookingConflictService,
    private readonly state: BookingStateService = bookingStateService,
    private readonly rules: RulesRepository = rulesRepository,
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly codeGenerator: (now: Date) => string = defaultBookingCode
  ) {}

  async createBookingHold(userId: string, input: CreateBookingInput) {
    const now = this.nowProvider();

    try {
      const booking = await this.db.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { userId },
            include: { priorityGroup: true }
          });

          if (!user) {
            throw new AppError(401, "Authenticated user no longer exists", "UNAUTHENTICATED");
          }

          this.assertUserCanCreateBooking(user, now);

          const policy = await new RulesRepository(tx).getEffectivePolicy({
            priorityGroupId: user.priorityGroupId,
            priorityGroupAdvanceBookingDays: user.priorityGroup?.advanceBookingDays ?? null
          });
          const court = await tx.court.findUnique({
            where: { courtId: input.courtId },
            include: courtBookingInclude
          });

          if (!court) {
            throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
          }

          this.assertBookingWindow(input.startDatetime, input.endDatetime, now);
          this.assertCourtCanBeBooked(court);
          const operatingHour = this.getOperatingHourOrThrow(court, input.startDatetime);
          this.assertWithinOperatingHours(input.startDatetime, input.endDatetime, operatingHour);
          this.assertSlotAligned(input.startDatetime, input.endDatetime, operatingHour);
          this.assertDurationAllowed(input.startDatetime, input.endDatetime, policy.maxDurationMinutes);
          this.assertAdvanceBookingAllowed(input.startDatetime, policy.advanceBookingDays, now);
          this.assertParticipantCountAllowed(input.participantCount, court.capacity);

          await this.assertDailyQuotaAvailable(tx, userId, input.startDatetime, now, policy.maxBookingsPerDay);
          await this.state.expireOverlappingPaymentHolds(tx, {
            courtId: input.courtId,
            startDatetime: input.startDatetime,
            endDatetime: input.endDatetime,
            now
          });
          await this.assertNoActiveOverlap(tx, input.courtId, input.startDatetime, input.endDatetime, now);

          const totalAmount = this.calculateTotalAmount({
            startDatetime: input.startDatetime,
            endDatetime: input.endDatetime,
            slotDurationMinutes: operatingHour.slotDurationMinutes,
            pricingRules: court.pricingRules,
            userPriorityGroupId: user.priorityGroupId,
            weekday: getIsoWeekday(input.startDatetime)
          });
          const createdBooking = await tx.booking.create({
            data: {
              bookingCode: this.codeGenerator(now),
              userId,
              courtId: input.courtId,
              startDatetime: input.startDatetime,
              endDatetime: input.endDatetime,
              participantCount: input.participantCount,
              usagePurpose: input.usagePurpose.trim(),
              totalAmount,
              bookingStatus: BookingStatus.PENDING_PAYMENT,
              paymentStatus: PaymentStatus.INITIATED,
              holdExpiresAt: addMinutes(now, policy.holdMinutes),
              refundable: true
            },
            select: {
              bookingId: true
            }
          });

          await this.state.recordStatusHistory(tx, {
            bookingId: createdBooking.bookingId,
            oldStatus: null,
            newStatus: BookingStatus.PENDING_PAYMENT,
            actionType: "USER_CREATE_BOOKING_HOLD",
            actionByUserId: userId,
            note: "Booking hold created pending full payment"
          });

          return this.getBookingById(tx, createdBooking.bookingId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toBookingDto(booking);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async listMyBookings(userId: string, query: ListMyBookingsQuery) {
    const bookings = await this.db.booking.findMany({
      where: {
        userId,
        ...(query.status ? { bookingStatus: query.status } : {}),
        ...(query.fromDate || query.toDate
          ? {
              startDatetime: {
                ...(query.fromDate ? { gte: query.fromDate } : {}),
                ...(query.toDate ? { lte: query.toDate } : {})
              }
            }
          : {})
      },
      include: bookingInclude,
      orderBy: [{ startDatetime: "desc" }]
    });

    return bookings.map(toBookingDto);
  }

  async getBookingDetail(userId: string, bookingId: string) {
    const booking = await this.db.booking.findFirst({
      where: {
        bookingId,
        userId
      },
      include: bookingInclude
    });

    if (!booking) {
      throw new AppError(404, "Booking not found", "BOOKING_NOT_FOUND");
    }

    return toBookingDto(booking);
  }

  async cancelMyBooking(userId: string, bookingId: string, input: CancelBookingInput) {
    const now = this.nowProvider();

    try {
      const booking = await this.db.$transaction(
        async (tx) => {
          const currentBooking = await tx.booking.findFirst({
            where: {
              bookingId,
              userId
            },
            include: {
              user: {
                include: {
                  priorityGroup: true
                }
              },
              payments: {
                orderBy: {
                  createdAt: "desc"
                }
              }
            }
          });

          if (!currentBooking) {
            throw new AppError(404, "Booking not found", "BOOKING_NOT_FOUND");
          }

          const policy = await this.rules.getEffectivePolicy({
            priorityGroupId: currentBooking.user.priorityGroupId,
            priorityGroupAdvanceBookingDays:
              currentBooking.user.priorityGroup?.advanceBookingDays ?? null
          });

          let paymentStatus = currentBooking.paymentStatus;
          let refundable = false;
          let noRefundReason: string | null = null;

          if (currentBooking.bookingStatus === BookingStatus.PENDING_PAYMENT) {
            paymentStatus = PaymentStatus.CANCELLED;
            noRefundReason = "Cancelled before payment success";
          } else if (currentBooking.bookingStatus === BookingStatus.CONFIRMED) {
            this.assertCancellationWindowOpen(currentBooking.startDatetime, policy.cancelBeforeHours, now);
            const successfulPayment = currentBooking.payments.find(
              (payment) => payment.paymentStatus === PaymentStatus.SUCCESS
            );

            if (successfulPayment && policy.refundRateUserOnTime > 0) {
              const refundAmount = successfulPayment.amount.mul(policy.refundRateUserOnTime).div(100);

              await tx.refund.create({
                data: {
                  paymentId: successfulPayment.paymentId,
                  bookingId: currentBooking.bookingId,
                  refundAmount,
                  refundReason: input.reason ?? "User cancelled booking within allowed window",
                  refundStatus: RefundStatus.REQUESTED,
                  requestedByUserId: userId
                }
              });

              refundable = true;
            } else if (!successfulPayment) {
              noRefundReason = "No successful payment found";
            } else {
              noRefundReason = "User cancellation refund rate is 0";
            }
          } else {
            throw new AppError(
              409,
              "Booking cannot be cancelled by user in its current status",
              "BOOKING_CANNOT_BE_CANCELLED"
            );
          }

          const updatedBooking = await tx.booking.update({
            where: {
              bookingId: currentBooking.bookingId
            },
            data: {
              bookingStatus: BookingStatus.CANCELLED_BY_USER,
              paymentStatus,
              refundable,
              noRefundReason,
              cancelReason: normalizeOptional(input.reason),
              cancelledByUserId: userId,
              cancelledAt: now,
              holdExpiresAt: null
            },
            select: {
              bookingId: true
            }
          });

          await this.state.recordStatusHistory(tx, {
            bookingId: updatedBooking.bookingId,
            oldStatus: currentBooking.bookingStatus,
            newStatus: BookingStatus.CANCELLED_BY_USER,
            actionType: "USER_CANCEL_BOOKING",
            actionByUserId: userId,
            note: input.reason ?? null
          });

          return this.getBookingById(tx, updatedBooking.bookingId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toBookingDto(booking);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  private async getBookingById(db: BookingDbClient, bookingId: string): Promise<BookingWithRelations> {
    return db.booking.findUniqueOrThrow({
      where: { bookingId },
      include: bookingInclude
    });
  }

  private assertUserCanCreateBooking(user: UserForBooking, now: Date): void {
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new AppError(403, "Account must be active to create a booking", "ACCOUNT_NOT_ACTIVE");
    }

    if (user.bookingPermissionStatus !== BookingPermissionStatus.ALLOWED) {
      throw new AppError(
        403,
        "Booking permission is restricted",
        "BOOKING_PERMISSION_RESTRICTED"
      );
    }

    if (user.bookingLockedUntil && user.bookingLockedUntil > now) {
      throw new AppError(
        403,
        "Booking permission is temporarily locked",
        "BOOKING_PERMISSION_LOCKED"
      );
    }
  }

  private assertBookingWindow(startDatetime: Date, endDatetime: Date, now: Date): void {
    if (startDatetime >= endDatetime) {
      throw new AppError(400, "startDatetime must be earlier than endDatetime", "INVALID_BOOKING_TIME");
    }

    if (startDatetime <= now) {
      throw new AppError(400, "Cannot create a booking in the past", "BOOKING_IN_PAST");
    }
  }

  private assertCourtCanBeBooked(court: CourtForBooking): void {
    if (court.status !== CourtStatus.ACTIVE) {
      throw new AppError(409, "Court is not active", "COURT_NOT_AVAILABLE");
    }
  }

  private getOperatingHourOrThrow(court: CourtForBooking, startDatetime: Date): OperatingHourForBooking {
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
    operatingHour: OperatingHourForBooking
  ): void {
    const startMinutes = utcMinutesFromDate(startDatetime);
    const endMinutes = utcMinutesFromDate(endDatetime);
    const openMinutes = minutesFromTime(operatingHour.openTime);
    const closeMinutes = minutesFromTime(operatingHour.closeTime);

    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      throw new AppError(400, "Booking must be within court operating hours", "OUTSIDE_OPERATING_HOURS");
    }
  }

  private assertSlotAligned(
    startDatetime: Date,
    endDatetime: Date,
    operatingHour: OperatingHourForBooking
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
        "Booking time must align with the court slot duration",
        "BOOKING_TIME_NOT_ALIGNED"
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
        "Booking duration exceeds configured maximum duration",
        "BOOKING_DURATION_EXCEEDS_LIMIT"
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
        "Booking is outside the user's advance booking window",
        "ADVANCE_BOOKING_LIMIT_EXCEEDED"
      );
    }
  }

  private assertParticipantCountAllowed(participantCount: number, courtCapacity: number): void {
    if (participantCount > courtCapacity) {
      throw new AppError(
        400,
        "Participant count exceeds court capacity",
        "PARTICIPANT_COUNT_EXCEEDS_CAPACITY"
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
    const existingCount = await tx.booking.count({
      where: {
        userId,
        startDatetime: {
          gte: dayStart,
          lt: dayEnd
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

  private async assertNoActiveOverlap(
    tx: Prisma.TransactionClient,
    courtId: string,
    startDatetime: Date,
    endDatetime: Date,
    now: Date
  ): Promise<void> {
    const existingBookings = await tx.booking.findMany({
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
        bookingId: true,
        bookingStatus: true,
        startDatetime: true,
        endDatetime: true,
        holdExpiresAt: true
      }
    });

    const conflict = this.conflicts.findConflict(
      { startDatetime, endDatetime },
      existingBookings,
      now
    );

    if (conflict) {
      throw new AppError(409, "Selected slot is no longer available", "BOOKING_SLOT_UNAVAILABLE");
    }
  }

  private calculateTotalAmount(input: {
    startDatetime: Date;
    endDatetime: Date;
    slotDurationMinutes: number;
    pricingRules: PricingRuleForBooking[];
    userPriorityGroupId: string | null;
    weekday: number;
  }): Prisma.Decimal {
    let totalAmount = new Prisma.Decimal(0);

    for (
      let cursor = input.startDatetime;
      cursor < input.endDatetime;
      cursor = addMinutes(cursor, input.slotDurationMinutes)
    ) {
      const segmentEnd = addMinutes(cursor, input.slotDurationMinutes);
      if (segmentEnd > input.endDatetime) {
        throw new AppError(
          400,
          "Booking duration must align with configured slot duration",
          "BOOKING_TIME_NOT_ALIGNED"
        );
      }

      const priceRule = this.resolvePricingRule({
        startDatetime: cursor,
        endDatetime: segmentEnd,
        pricingRules: input.pricingRules,
        userPriorityGroupId: input.userPriorityGroupId,
        weekday: input.weekday
      });

      totalAmount = totalAmount.add(priceRule.priceAmount);
    }

    return totalAmount;
  }

  private resolvePricingRule(input: {
    startDatetime: Date;
    endDatetime: Date;
    pricingRules: PricingRuleForBooking[];
    userPriorityGroupId: string | null;
    weekday: number;
  }): PricingRuleForBooking {
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
    const defaultRule = matchingRules.find((rule) => rule.priorityGroupId === null);
    const selectedRule = userSpecificRule ?? defaultRule;

    if (!selectedRule) {
      throw new AppError(400, "No pricing rule covers the requested slot", "PRICING_RULE_NOT_FOUND");
    }

    return selectedRule;
  }

  private assertCancellationWindowOpen(
    startDatetime: Date,
    cancelBeforeHours: number,
    now: Date
  ): void {
    const latestCancellationTime = new Date(startDatetime.getTime() - cancelBeforeHours * 60 * 60_000);

    if (now > latestCancellationTime) {
      throw new AppError(
        409,
        "Booking can no longer be cancelled by user",
        "BOOKING_CANCEL_WINDOW_CLOSED"
      );
    }
  }
}

function defaultBookingCode(now: Date): string {
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${datePart}-${randomPart}`;
}

export const bookingsService = new BookingsService();

