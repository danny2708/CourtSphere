import {
  AccountStatus,
  BookingPermissionStatus,
  BookingStatus,
  CourtStatus,
  EntityStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import {
  ACTIVE_BOOKING_STATUSES,
  bookingConflictService,
  type BookingConflictService
} from "../availability/booking-conflict.service";
import {
  notificationsService,
  type NotificationsService
} from "../notifications/notifications.service";
import { refundsService, type RefundsService } from "../refunds/refunds.service";
import { RulesRepository, rulesRepository } from "../rules/rules.repository";
import { violationsService, type ViolationsService } from "../violations/violations.service";
import type {
  CancelBookingInput,
  CreateBookingInput,
  ListMyBookingsQuery
} from "./bookings.types";
import { bookingStateService, type BookingStateService } from "./booking-state.service";

const bookingOrderInclude = {
  user: {
    select: {
      userId: true,
      fullName: true,
      email: true
    }
  },
  items: {
    include: {
      court: {
        include: {
          courtType: true
        }
      },
      itemStatusHistories: {
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
      }
    },
    orderBy: [{ startDatetime: "asc" as const }]
  },
  orderStatusHistories: {
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
} satisfies Prisma.BookingOrderInclude;

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

type BookingOrderWithRelations = Prisma.BookingOrderGetPayload<{ include: typeof bookingOrderInclude }>;
type CourtForBooking = Prisma.CourtGetPayload<{ include: typeof courtBookingInclude }>;
type PricingRuleForBooking = CourtForBooking["pricingRules"][number];
type OperatingHourForBooking = CourtForBooking["operatingHours"][number];
type UserForBooking = Prisma.UserGetPayload<{ include: { priorityGroup: true } }>;
type BookingDbClient = PrismaClient | Prisma.TransactionClient;
const userCancellableItemStatuses: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING,
  BookingStatus.CONFIRMED
];
type PreparedBookingItem = {
  courtId: string;
  startDatetime: Date;
  endDatetime: Date;
  unitPrice: Prisma.Decimal;
  amount: Prisma.Decimal;
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

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function earliestItemStart(order: BookingOrderWithRelations | { items: Array<{ startDatetime: Date }> }): Date {
  return order.items.reduce((earliest, item) =>
    item.startDatetime < earliest ? item.startDatetime : earliest,
  order.items[0].startDatetime);
}

function toBookingOrderDto(order: BookingOrderWithRelations) {
  return {
    id: order.bookingOrderId,
    bookingOrderId: order.bookingOrderId,
    bookingCode: order.bookingCode,
    user: {
      id: order.user.userId,
      fullName: order.user.fullName,
      email: order.user.email
    },
    totalAmount: decimalToNumber(order.totalAmount),
    bookingStatus: order.bookingStatus,
    paymentStatus: order.paymentStatus,
    refundable: order.refundable,
    holdExpiresAt: order.holdExpiresAt,
    note: order.note,
    cancelReason: order.cancelReason,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((item) => ({
      id: item.bookingItemId,
      bookingItemId: item.bookingItemId,
      court: {
        id: item.court.courtId,
        courtName: item.court.courtName,
        status: item.court.status,
        courtType: {
          id: item.court.courtType.courtTypeId,
          typeName: item.court.courtType.typeName
        }
      },
      startDatetime: item.startDatetime,
      endDatetime: item.endDatetime,
      unitPrice: decimalToNumber(item.unitPrice),
      amount: decimalToNumber(item.amount),
      bookingStatus: item.bookingStatus,
      checkinTime: item.checkinTime,
      checkedInByUserId: item.checkedInByUserId,
      completedByUserId: item.completedByUserId,
      noShowMarkedByUserId: item.noShowMarkedByUserId,
      managerNote: item.managerNote,
      statusHistories: item.itemStatusHistories.map((history) => ({
        id: history.bookingItemStatusHistoryId,
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
      }))
    })),
    statusHistories: order.orderStatusHistories.map((history) => ({
      id: history.bookingOrderStatusHistoryId,
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
    payments: order.payments.map((payment) => ({
      id: payment.paymentId,
      amount: decimalToNumber(payment.amount),
      paymentMethod: payment.paymentMethod,
      gatewayTransactionId: payment.gatewayTransactionId,
      paymentStatus: payment.paymentStatus,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt
    })),
    refunds: order.refunds.map((refund) => ({
      id: refund.refundId,
      paymentId: refund.paymentId,
      bookingOrderId: refund.bookingOrderId,
      bookingItemId: refund.bookingItemId,
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

  if (message.includes("no_overlapping_active_booking_items")) {
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
    private readonly refunds: RefundsService = refundsService,
    private readonly violations: ViolationsService = violationsService,
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly codeGenerator: (now: Date) => string = defaultBookingCode,
    private readonly notifications: NotificationsService = notificationsService
  ) {}

  async createBookingHold(userId: string, input: CreateBookingInput) {
    const now = this.nowProvider();

    try {
      const order = await this.db.$transaction(
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
          await this.assertDailyQuotaAvailableForItems(tx, userId, input.items, now, policy.maxBookingsPerDay);

          const preparedItems: PreparedBookingItem[] = [];
          for (const item of input.items) {
            const court = await tx.court.findUnique({
              where: { courtId: item.courtId },
              include: courtBookingInclude
            });

            if (!court) {
              throw new AppError(404, "Court not found", "COURT_NOT_FOUND");
            }

            this.assertBookingWindow(item.startDatetime, item.endDatetime, now);
            this.assertCourtCanBeBooked(court);
            const operatingHour = this.getOperatingHourOrThrow(court, item.startDatetime);
            this.assertWithinOperatingHours(item.startDatetime, item.endDatetime, operatingHour);
            this.assertSlotAligned(item.startDatetime, item.endDatetime, operatingHour);
            this.assertDurationAllowed(item.startDatetime, item.endDatetime, policy.maxDurationMinutes);
            this.assertAdvanceBookingAllowed(item.startDatetime, policy.advanceBookingDays, now);

            await this.state.expireOverlappingPaymentHolds(tx, {
              courtId: item.courtId,
              startDatetime: item.startDatetime,
              endDatetime: item.endDatetime,
              now
            });
            await this.assertNoActiveOverlap(tx, item.courtId, item.startDatetime, item.endDatetime, now);

            const pricing = this.calculateItemAmount({
              startDatetime: item.startDatetime,
              endDatetime: item.endDatetime,
              slotDurationMinutes: operatingHour.slotDurationMinutes,
              pricingRules: court.pricingRules,
              userPriorityGroupId: user.priorityGroupId,
              weekday: getIsoWeekday(item.startDatetime)
            });

            preparedItems.push({
              courtId: item.courtId,
              startDatetime: item.startDatetime,
              endDatetime: item.endDatetime,
              unitPrice: pricing.unitPrice,
              amount: pricing.amount
            });
          }

          const totalAmount = preparedItems.reduce(
            (sum, item) => sum.add(item.amount),
            new Prisma.Decimal(0)
          );
          const createdOrder = await tx.bookingOrder.create({
            data: {
              bookingCode: this.codeGenerator(now),
              userId,
              totalAmount,
              bookingStatus: BookingStatus.PENDING_PAYMENT,
              paymentStatus: PaymentStatus.INITIATED,
              holdExpiresAt: addMinutes(now, policy.holdMinutes),
              refundable: true,
              note: normalizeOptional(input.note),
              items: {
                create: preparedItems.map((item) => ({
                  courtId: item.courtId,
                  startDatetime: item.startDatetime,
                  endDatetime: item.endDatetime,
                  unitPrice: item.unitPrice,
                  amount: item.amount,
                  bookingStatus: BookingStatus.PENDING_PAYMENT
                }))
              }
            },
            select: {
              bookingOrderId: true,
              bookingCode: true
            }
          });

          const createdItems = await tx.bookingItem.findMany({
            where: { bookingOrderId: createdOrder.bookingOrderId },
            select: { bookingItemId: true }
          });

          await this.state.recordOrderStatusHistory(tx, {
            bookingOrderId: createdOrder.bookingOrderId,
            oldStatus: null,
            newStatus: BookingStatus.PENDING_PAYMENT,
            actionType: "USER_CREATE_BOOKING_ORDER_HOLD",
            actionByUserId: userId,
            note: "Booking order hold created pending full payment"
          });

          for (const item of createdItems) {
            await this.state.recordItemStatusHistory(tx, {
              bookingItemId: item.bookingItemId,
              oldStatus: null,
              newStatus: BookingStatus.PENDING_PAYMENT,
              actionType: "USER_CREATE_BOOKING_ITEM_HOLD",
              actionByUserId: userId,
              note: "Booking item hold created pending full payment"
            });
          }

          await this.notifications.createBookingNotification(tx, {
            userId,
            bookingOrderId: createdOrder.bookingOrderId,
            notificationType: NotificationType.BOOKING_CREATED,
            title: "Booking hold created",
            content: `Booking ${createdOrder.bookingCode} is pending full payment.`
          });

          return this.getBookingOrderById(tx, createdOrder.bookingOrderId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toBookingOrderDto(order);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async listMyBookings(userId: string, query: ListMyBookingsQuery) {
    const orders = await this.db.bookingOrder.findMany({
      where: {
        userId,
        ...(query.status ? { bookingStatus: query.status } : {}),
        ...(query.fromDate || query.toDate
          ? {
              items: {
                some: {
                  startDatetime: {
                    ...(query.fromDate ? { gte: query.fromDate } : {}),
                    ...(query.toDate ? { lte: query.toDate } : {})
                  }
                }
              }
            }
          : {})
      },
      include: bookingOrderInclude,
      orderBy: [{ createdAt: "desc" }]
    });

    return orders.map(toBookingOrderDto);
  }

  async getBookingDetail(userId: string, bookingOrderId: string) {
    const order = await this.db.bookingOrder.findFirst({
      where: {
        bookingOrderId,
        userId
      },
      include: bookingOrderInclude
    });

    if (!order) {
      throw new AppError(404, "Booking order not found", "BOOKING_NOT_FOUND");
    }

    return toBookingOrderDto(order);
  }

  async cancelMyBooking(userId: string, bookingOrderId: string, input: CancelBookingInput) {
    const now = this.nowProvider();

    try {
      const order = await this.db.$transaction(
        async (tx) => {
          const currentOrder = await tx.bookingOrder.findFirst({
            where: {
              bookingOrderId,
              userId
            },
            include: {
              user: {
                include: {
                  priorityGroup: true
                }
              },
              items: true,
              payments: {
                orderBy: {
                  createdAt: "desc"
                }
              }
            }
          });

          if (!currentOrder) {
            throw new AppError(404, "Booking order not found", "BOOKING_NOT_FOUND");
          }

          const policy = await this.rules.getEffectivePolicy({
            priorityGroupId: currentOrder.user.priorityGroupId,
            priorityGroupAdvanceBookingDays:
              currentOrder.user.priorityGroup?.advanceBookingDays ?? null
          });

          let paymentStatus = currentOrder.paymentStatus;
          let refundable = false;

          if (currentOrder.bookingStatus === BookingStatus.PENDING_PAYMENT) {
            paymentStatus = PaymentStatus.CANCELLED;
          } else if (currentOrder.bookingStatus === BookingStatus.CONFIRMED) {
            const isOnTimeCancellation = this.isCancellationWindowOpen(
              earliestItemStart(currentOrder),
              policy.cancelBeforeHours,
              now
            );
            const successfulPayment = currentOrder.payments.find(
              (payment) => payment.paymentStatus === PaymentStatus.SUCCESS
            );

            if (isOnTimeCancellation && successfulPayment && policy.refundRateUserOnTime > 0) {
              const refundResult = await this.refunds.createRefundForBooking(tx, {
                bookingOrderId: currentOrder.bookingOrderId,
                bookingStatus: currentOrder.bookingStatus,
                payment: successfulPayment,
                refundRate: policy.refundRateUserOnTime,
                refundReason: input.reason ?? "User cancelled booking order within allowed window",
                requestedByUserId: userId
              });

              refundable = refundResult !== null;
            } else if (!isOnTimeCancellation) {
              await this.violations.createLateCancelViolationIfNeeded(tx, {
                userId,
                items: currentOrder.items,
                reason: input.reason ?? null
              });
            }
          } else {
            throw new AppError(
              409,
              "Booking order cannot be cancelled by user in its current status",
              "BOOKING_CANNOT_BE_CANCELLED"
            );
          }

          const updatedOrder = await tx.bookingOrder.update({
            where: {
              bookingOrderId: currentOrder.bookingOrderId
            },
            data: {
              bookingStatus: BookingStatus.CANCELLED_BY_USER,
              paymentStatus,
              refundable,
              cancelReason: normalizeOptional(input.reason),
              cancelledByUserId: userId,
              cancelledAt: now,
              holdExpiresAt: null
            },
            select: {
              bookingOrderId: true
            }
          });

          const cancellableItems = currentOrder.items.filter((item) =>
            userCancellableItemStatuses.includes(item.bookingStatus)
          );

          await tx.bookingItem.updateMany({
            where: {
              bookingOrderId: currentOrder.bookingOrderId,
              bookingStatus: {
                in: userCancellableItemStatuses
              }
            },
            data: {
              bookingStatus: BookingStatus.CANCELLED_BY_USER
            }
          });

          await this.state.recordOrderStatusHistory(tx, {
            bookingOrderId: updatedOrder.bookingOrderId,
            oldStatus: currentOrder.bookingStatus,
            newStatus: BookingStatus.CANCELLED_BY_USER,
            actionType: "USER_CANCEL_BOOKING_ORDER",
            actionByUserId: userId,
            note: input.reason ?? null
          });

          for (const item of cancellableItems) {
            await this.state.recordItemStatusHistory(tx, {
              bookingItemId: item.bookingItemId,
              oldStatus: item.bookingStatus,
              newStatus: BookingStatus.CANCELLED_BY_USER,
              actionType: "USER_CANCEL_BOOKING_ITEM",
              actionByUserId: userId,
              note: input.reason ?? null
            });
          }

          await this.notifications.createBookingNotification(tx, {
            userId,
            bookingOrderId: currentOrder.bookingOrderId,
            notificationType: NotificationType.BOOKING_CANCELLED,
            title: "Booking cancelled",
            content: `Booking ${currentOrder.bookingCode} was cancelled.`
          });

          return this.getBookingOrderById(tx, updatedOrder.bookingOrderId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toBookingOrderDto(order);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  private async getBookingOrderById(
    db: BookingDbClient,
    bookingOrderId: string
  ): Promise<BookingOrderWithRelations> {
    return db.bookingOrder.findUniqueOrThrow({
      where: { bookingOrderId },
      include: bookingOrderInclude
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

  private async assertDailyQuotaAvailableForItems(
    tx: Prisma.TransactionClient,
    userId: string,
    items: CreateBookingInput["items"],
    now: Date,
    maxBookingsPerDay: number
  ): Promise<void> {
    const uniqueDayStarts = [
      ...new Set(items.map((item) => startOfUtcDay(item.startDatetime).toISOString()))
    ].map((value) => new Date(value));

    for (const dayStart of uniqueDayStarts) {
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
  }

  private async assertNoActiveOverlap(
    tx: Prisma.TransactionClient,
    courtId: string,
    startDatetime: Date,
    endDatetime: Date,
    now: Date
  ): Promise<void> {
    const existingItems = await tx.bookingItem.findMany({
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

    const conflict = this.conflicts.findConflict(
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

    if (conflict) {
      throw new AppError(409, "Selected slot is no longer available", "BOOKING_SLOT_UNAVAILABLE");
    }
  }

  private calculateItemAmount(input: {
    startDatetime: Date;
    endDatetime: Date;
    slotDurationMinutes: number;
    pricingRules: PricingRuleForBooking[];
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

  private isCancellationWindowOpen(
    startDatetime: Date,
    cancelBeforeHours: number,
    now: Date
  ): boolean {
    const latestCancellationTime = new Date(startDatetime.getTime() - cancelBeforeHours * 60 * 60_000);

    return now <= latestCancellationTime;
  }
}

function defaultBookingCode(now: Date): string {
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${datePart}-${randomPart}`;
}

export const bookingsService = new BookingsService();
