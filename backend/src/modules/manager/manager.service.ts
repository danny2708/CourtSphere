import {
  BookingStatus,
  PaymentStatus,
  NotificationType,
  Prisma,
  PrismaClient,
  ViolationType
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { recomputeBookingOrderStatus } from "../../jobs/booking-order-aggregate";
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
import { violationsService, type ViolationsService } from "../violations/violations.service";
import type {
  AuditContext,
  ManagerNoShowInput,
  ManagerReasonInput,
  ManagerTodayScheduleQuery
} from "./manager.types";

const managerBookingItemInclude = {
  bookingOrder: {
    include: {
      user: {
        include: {
          priorityGroup: true
        }
      }
    }
  },
  court: {
    include: {
      courtType: true
    }
  }
} satisfies Prisma.BookingItemInclude;

type ManagerBookingItem = Prisma.BookingItemGetPayload<{
  include: typeof managerBookingItemInclude;
}>;
type ManagerDbClient = PrismaClient | Prisma.TransactionClient;

const checkInAllowedOrderStatuses: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_USE
];
const notCheckInableStatuses: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING,
  BookingStatus.PAYMENT_EXPIRED,
  BookingStatus.CANCELLED_BY_USER,
  BookingStatus.CANCELLED_BY_MANAGER,
  BookingStatus.CANCELLED_BY_ADMIN,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW
];

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toManagerBookingItemDto(item: ManagerBookingItem) {
  return {
    id: item.bookingItemId,
    bookingItemId: item.bookingItemId,
    bookingOrderId: item.bookingOrderId,
    bookingCode: item.bookingOrder.bookingCode,
    court: {
      id: item.court.courtId,
      courtName: item.court.courtName,
      status: item.court.status,
      courtType: {
        id: item.court.courtType.courtTypeId,
        typeName: item.court.courtType.typeName
      }
    },
    user: {
      id: item.bookingOrder.user.userId,
      fullName: item.bookingOrder.user.fullName,
      email: item.bookingOrder.user.email
    },
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    unitPrice: decimalToNumber(item.unitPrice),
    amount: decimalToNumber(item.amount),
    itemStatus: item.bookingStatus,
    paymentStatus: item.bookingOrder.paymentStatus,
    checkinTime: item.checkinTime,
    checkedInByUserId: item.checkedInByUserId,
    completedByUserId: item.completedByUserId,
    noShowMarkedByUserId: item.noShowMarkedByUserId,
    managerNote: item.managerNote
  };
}

function handleKnownPrismaError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("no_overlapping_active_booking_items")) {
    throw new AppError(409, "Booking item conflicts with an active item", "BOOKING_ITEM_CONFLICT");
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2034") {
      throw new AppError(409, "Manager operation conflicted, please retry", "MANAGER_OPERATION_RETRY_REQUIRED");
    }
  }

  throw error;
}

export class ManagerService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly state: BookingStateService = bookingStateService,
    private readonly conflicts: BookingConflictService = bookingConflictService,
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly notifications: NotificationsService = notificationsService,
    private readonly violations: ViolationsService = violationsService
  ) {}

  async getTodaySchedule(query: ManagerTodayScheduleQuery) {
    const now = this.nowProvider();
    const dayStart = startOfUtcDay(now);
    const dayEnd = addDays(dayStart, 1);
    const items = await this.db.bookingItem.findMany({
      where: {
        startDatetime: {
          gte: dayStart,
          lt: dayEnd
        },
        ...(query.courtId ? { courtId: query.courtId } : {}),
        ...(query.status ? { bookingStatus: query.status } : {})
      },
      include: managerBookingItemInclude,
      orderBy: [{ startDatetime: "asc" }, { courtId: "asc" }]
    });

    return items.map(toManagerBookingItemDto);
  }

  async checkInBookingItem(bookingItemId: string, audit: AuditContext) {
    const now = this.nowProvider();

    try {
      await this.db.$transaction(
        async (tx) => {
          const item = await this.getBookingItemOrThrow(tx, bookingItemId);
          const bookingRule = await new RulesRepository(tx).getBookingRuleForPolicy();

          this.assertCanCheckIn(item, now, bookingRule.lateCheckinMinutes);

          await tx.bookingItem.update({
            where: { bookingItemId },
            data: {
              bookingStatus: BookingStatus.IN_USE,
              checkinTime: now,
              checkedInByUserId: audit.actorUserId
            }
          });
          await this.state.recordItemStatusHistory(tx, {
            bookingItemId,
            oldStatus: item.bookingStatus,
            newStatus: BookingStatus.IN_USE,
            actionType: "MANAGER_CHECK_IN_BOOKING_ITEM",
            actionByUserId: audit.actorUserId,
            note: "Booking item checked in by field manager/admin"
          });
          await this.recomputeOrderStatusIfNeeded(tx, item.bookingOrderId, audit.actorUserId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toManagerBookingItemDto(await this.getBookingItemOrThrow(this.db, bookingItemId));
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async overrideLateCheckin(
    bookingItemId: string,
    input: ManagerReasonInput,
    audit: AuditContext
  ) {
    const now = this.nowProvider();

    try {
      await this.db.$transaction(
        async (tx) => {
          const item = await this.getBookingItemOrThrow(tx, bookingItemId);

          this.assertBookingItemStatus(
            item.bookingStatus,
            BookingStatus.CHECKIN_EXPIRED,
            "Booking item can only be overridden from CHECKIN_EXPIRED",
            "BOOKING_ITEM_OVERRIDE_NOT_ALLOWED"
          );
          this.assertOrderPaymentSucceeded(item);
          await this.assertNoActiveConflict(tx, item, now);

          await tx.bookingItem.update({
            where: { bookingItemId },
            data: {
              bookingStatus: BookingStatus.IN_USE,
              checkinTime: now,
              checkedInByUserId: audit.actorUserId,
              managerNote: input.reason
            }
          });
          await this.state.recordItemStatusHistory(tx, {
            bookingItemId,
            oldStatus: item.bookingStatus,
            newStatus: BookingStatus.IN_USE,
            actionType: "MANAGER_OVERRIDE_LATE_CHECKIN",
            actionByUserId: audit.actorUserId,
            note: input.reason
          });
          await this.createAuditLog(tx, audit, {
            entityType: "BOOKING_ITEM",
            entityId: bookingItemId,
            action: "MANAGER_OVERRIDE_LATE_CHECKIN",
            oldValue: {
              bookingStatus: item.bookingStatus,
              checkinTime: item.checkinTime
            },
            newValue: {
              bookingStatus: BookingStatus.IN_USE,
              checkinTime: now,
              reason: input.reason
            }
          });
          await this.recomputeOrderStatusIfNeeded(tx, item.bookingOrderId, audit.actorUserId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toManagerBookingItemDto(await this.getBookingItemOrThrow(this.db, bookingItemId));
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async markNoShow(bookingItemId: string, input: ManagerNoShowInput, audit: AuditContext) {
    try {
      const result = await this.db.$transaction(
        async (tx) => {
          const item = await this.getBookingItemOrThrow(tx, bookingItemId);

          this.assertBookingItemStatus(
            item.bookingStatus,
            BookingStatus.CHECKIN_EXPIRED,
            "Only CHECKIN_EXPIRED booking items can be marked no-show",
            "BOOKING_ITEM_NO_SHOW_NOT_ALLOWED"
          );

          const note = normalizeOptional(input.reason) ?? "No-show confirmed by field manager/admin";
          const penaltyPoints = await new RulesRepository(tx).getNoShowPenaltyPoints();

          await tx.bookingItem.update({
            where: { bookingItemId },
            data: {
              bookingStatus: BookingStatus.NO_SHOW,
              noShowMarkedByUserId: audit.actorUserId,
              managerNote: note
            }
          });
          await this.state.recordItemStatusHistory(tx, {
            bookingItemId,
            oldStatus: item.bookingStatus,
            newStatus: BookingStatus.NO_SHOW,
            actionType: "MANAGER_MARK_NO_SHOW",
            actionByUserId: audit.actorUserId,
            note
          });

          await this.notifications.createBookingNotification(tx, {
            userId: item.bookingOrder.userId,
            bookingOrderId: item.bookingOrderId,
            bookingItemId,
            notificationType: NotificationType.NO_SHOW,
            title: "No-show recorded",
            content: `Booking ${item.bookingOrder.bookingCode} was marked no-show.`
          });
          const violationResult = await this.violations.createViolation(tx, {
            userId: item.bookingOrder.userId,
            bookingItemId,
            violationType: ViolationType.NO_SHOW,
            penaltyPoints,
            description: note,
            recordedByUserId: audit.actorUserId
          });
          await this.createAuditLog(tx, audit, {
            entityType: "BOOKING_ITEM",
            entityId: bookingItemId,
            action: "MANAGER_MARK_NO_SHOW",
            oldValue: {
              bookingStatus: item.bookingStatus,
              userViolationPoints: item.bookingOrder.user.violationPoints
            },
            newValue: {
              bookingStatus: BookingStatus.NO_SHOW,
              violationId: violationResult.violation.violationId,
              penaltyPoints,
              violationCreated: violationResult.created,
              userRestricted: violationResult.restrictedUser,
              reason: note
            }
          });
          await this.recomputeOrderStatusIfNeeded(tx, item.bookingOrderId, audit.actorUserId);

          return violationResult.violation;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return {
        bookingItem: toManagerBookingItemDto(await this.getBookingItemOrThrow(this.db, bookingItemId)),
        violation: result
      };
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async overrideComplete(bookingItemId: string, input: ManagerReasonInput, audit: AuditContext) {
    try {
      await this.db.$transaction(
        async (tx) => {
          const item = await this.getBookingItemOrThrow(tx, bookingItemId);

          this.assertBookingItemStatus(
            item.bookingStatus,
            BookingStatus.IN_USE,
            "Only IN_USE booking items can be completed manually",
            "BOOKING_ITEM_COMPLETE_NOT_ALLOWED"
          );

          await tx.bookingItem.update({
            where: { bookingItemId },
            data: {
              bookingStatus: BookingStatus.COMPLETED,
              completedByUserId: audit.actorUserId,
              managerNote: input.reason
            }
          });
          await this.state.recordItemStatusHistory(tx, {
            bookingItemId,
            oldStatus: item.bookingStatus,
            newStatus: BookingStatus.COMPLETED,
            actionType: "MANAGER_OVERRIDE_COMPLETE_BOOKING_ITEM",
            actionByUserId: audit.actorUserId,
            note: input.reason
          });
          await this.createAuditLog(tx, audit, {
            entityType: "BOOKING_ITEM",
            entityId: bookingItemId,
            action: "MANAGER_OVERRIDE_COMPLETE_BOOKING_ITEM",
            oldValue: {
              bookingStatus: item.bookingStatus
            },
            newValue: {
              bookingStatus: BookingStatus.COMPLETED,
              completedByUserId: audit.actorUserId,
              reason: input.reason
            }
          });
          await this.recomputeOrderStatusIfNeeded(tx, item.bookingOrderId, audit.actorUserId);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toManagerBookingItemDto(await this.getBookingItemOrThrow(this.db, bookingItemId));
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async recomputeOrderStatusIfNeeded(
    tx: Prisma.TransactionClient,
    bookingOrderId: string,
    actionByUserId?: string | null
  ): Promise<void> {
    await recomputeBookingOrderStatus(tx, {
      bookingOrderId,
      actionByUserId,
      state: this.state
    });
  }

  private async getBookingItemOrThrow(
    db: ManagerDbClient,
    bookingItemId: string
  ): Promise<ManagerBookingItem> {
    const item = await db.bookingItem.findUnique({
      where: { bookingItemId },
      include: managerBookingItemInclude
    });

    if (!item) {
      throw new AppError(404, "Booking item not found", "BOOKING_ITEM_NOT_FOUND");
    }

    return item;
  }

  private assertCanCheckIn(
    item: ManagerBookingItem,
    now: Date,
    lateCheckinMinutes: number
  ): void {
    if (notCheckInableStatuses.includes(item.bookingStatus) || item.bookingStatus !== BookingStatus.CONFIRMED) {
      throw new AppError(
        409,
        "Booking item cannot be checked in in its current status",
        "BOOKING_ITEM_CANNOT_CHECK_IN"
      );
    }

    if (!checkInAllowedOrderStatuses.includes(item.bookingOrder.bookingStatus)) {
      throw new AppError(
        409,
        "Booking order cannot be checked in in its current status",
        "BOOKING_ORDER_CANNOT_CHECK_IN"
      );
    }

    this.assertOrderPaymentSucceeded(item);

    const earliestCheckinAt = addMinutes(item.startDatetime, -lateCheckinMinutes);
    const latestCheckinAt = addMinutes(item.startDatetime, lateCheckinMinutes);

    if (now < earliestCheckinAt) {
      throw new AppError(409, "Check-in is too early for this booking item", "CHECKIN_TOO_EARLY");
    }

    if (now > latestCheckinAt || now > item.endDatetime) {
      throw new AppError(
        409,
        "Check-in window has expired; use manager override if allowed",
        "CHECKIN_WINDOW_EXPIRED"
      );
    }
  }

  private assertOrderPaymentSucceeded(item: ManagerBookingItem): void {
    if (item.bookingOrder.paymentStatus !== PaymentStatus.SUCCESS) {
      throw new AppError(409, "Booking order has not been fully paid", "BOOKING_ORDER_NOT_PAID");
    }
  }

  private assertBookingItemStatus(
    actual: BookingStatus,
    expected: BookingStatus,
    message: string,
    code: string
  ): void {
    if (actual !== expected) {
      throw new AppError(409, message, code);
    }
  }

  private async assertNoActiveConflict(
    tx: Prisma.TransactionClient,
    item: ManagerBookingItem,
    now: Date
  ): Promise<void> {
    const existingItems = await tx.bookingItem.findMany({
      where: {
        bookingItemId: {
          not: item.bookingItemId
        },
        courtId: item.courtId,
        bookingStatus: {
          in: [...ACTIVE_BOOKING_STATUSES]
        },
        startDatetime: {
          lt: item.endDatetime
        },
        endDatetime: {
          gt: item.startDatetime
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
      {
        startDatetime: item.startDatetime,
        endDatetime: item.endDatetime
      },
      existingItems.map((existingItem) => ({
        bookingItemId: existingItem.bookingItemId,
        bookingOrderId: existingItem.bookingOrderId,
        bookingStatus: existingItem.bookingStatus,
        startDatetime: existingItem.startDatetime,
        endDatetime: existingItem.endDatetime,
        holdExpiresAt: existingItem.bookingOrder.holdExpiresAt
      })),
      now
    );

    if (conflict) {
      throw new AppError(409, "Booking item conflicts with an active item", "BOOKING_ITEM_CONFLICT");
    }
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient,
    audit: AuditContext,
    input: {
      entityType: string;
      entityId: string;
      action: string;
      oldValue: unknown;
      newValue: unknown;
    }
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId: audit.actorUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue: jsonSafe(input.oldValue),
        newValue: jsonSafe(input.newValue),
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      }
    });
  }
}

export const managerService = new ManagerService();
