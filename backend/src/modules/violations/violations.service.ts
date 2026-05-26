import {
  BookingPermissionStatus,
  BookingStatus,
  NotificationType,
  Prisma,
  PrismaClient,
  ViolationType
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import {
  notificationsService,
  type NotificationsService
} from "../notifications/notifications.service";
import { RulesRepository } from "../rules/rules.repository";
import type {
  AdjustViolationPointsInput,
  AuditContext,
  ListViolationsQuery,
  WaiveViolationInput
} from "./violations.types";

const violationInclude = {
  user: {
    select: {
      userId: true,
      fullName: true,
      email: true,
      bookingPermissionStatus: true,
      bookingLockedUntil: true,
      violationPoints: true
    }
  },
  bookingItem: {
    include: {
      court: {
        select: {
          courtId: true,
          courtName: true
        }
      },
      bookingOrder: {
        select: {
          bookingOrderId: true,
          bookingCode: true,
          bookingStatus: true,
          paymentStatus: true
        }
      }
    }
  },
  recordedBy: {
    select: {
      userId: true,
      fullName: true,
      email: true
    }
  }
} satisfies Prisma.ViolationInclude;

type ViolationWithRelations = Prisma.ViolationGetPayload<{ include: typeof violationInclude }>;
type ViolationDbClient = PrismaClient | Prisma.TransactionClient;

export type ViolationCreationResult = {
  violation: ReturnType<typeof toViolationDto>;
  created: boolean;
  restrictedUser: boolean;
};

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toViolationDto(violation: ViolationWithRelations) {
  return {
    id: violation.violationId,
    violationId: violation.violationId,
    userId: violation.userId,
    bookingItemId: violation.bookingItemId,
    violationType: violation.violationType,
    penaltyPoints: violation.penaltyPoints,
    description: violation.description,
    recordedByUserId: violation.recordedByUserId,
    isWaived: violation.isWaived,
    recordedAt: violation.recordedAt,
    user: {
      id: violation.user.userId,
      fullName: violation.user.fullName,
      email: violation.user.email,
      bookingPermissionStatus: violation.user.bookingPermissionStatus,
      bookingLockedUntil: violation.user.bookingLockedUntil,
      violationPoints: violation.user.violationPoints
    },
    bookingItem: violation.bookingItem
      ? {
          id: violation.bookingItem.bookingItemId,
          bookingItemId: violation.bookingItem.bookingItemId,
          bookingOrderId: violation.bookingItem.bookingOrderId,
          startDatetime: violation.bookingItem.startDatetime,
          endDatetime: violation.bookingItem.endDatetime,
          bookingStatus: violation.bookingItem.bookingStatus,
          court: {
            id: violation.bookingItem.court.courtId,
            courtName: violation.bookingItem.court.courtName
          },
          bookingOrder: {
            id: violation.bookingItem.bookingOrder.bookingOrderId,
            bookingOrderId: violation.bookingItem.bookingOrder.bookingOrderId,
            bookingCode: violation.bookingItem.bookingOrder.bookingCode,
            bookingStatus: violation.bookingItem.bookingOrder.bookingStatus,
            paymentStatus: violation.bookingItem.bookingOrder.paymentStatus
          }
        }
      : null,
    recordedByUser: violation.recordedBy
      ? {
          id: violation.recordedBy.userId,
          fullName: violation.recordedBy.fullName,
          email: violation.recordedBy.email
        }
      : null
  };
}

function handleKnownPrismaError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("violations_booking_item_type_unique_idx")) {
    throw new AppError(409, "Violation already exists for booking item", "VIOLATION_ALREADY_EXISTS");
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "Violation already exists", "VIOLATION_ALREADY_EXISTS");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2034") {
      throw new AppError(409, "Violation transaction conflicted, please retry", "VIOLATION_RETRY_REQUIRED");
    }
  }

  throw error;
}

export class ViolationsService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly nowProvider: () => Date = () => new Date(),
    private readonly notifications: NotificationsService = notificationsService
  ) {}

  async listViolations(query: ListViolationsQuery) {
    const violations = await this.db.violation.findMany({
      where: {
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.violationType ? { violationType: query.violationType } : {}),
        ...(query.isWaived !== undefined ? { isWaived: query.isWaived } : {}),
        ...(query.bookingItemId ? { bookingItemId: query.bookingItemId } : {}),
        ...(query.fromDate || query.toDate
          ? {
              recordedAt: {
                ...(query.fromDate ? { gte: query.fromDate } : {}),
                ...(query.toDate ? { lte: query.toDate } : {})
              }
            }
          : {})
      },
      include: violationInclude,
      orderBy: [{ recordedAt: "desc" }]
    });

    return violations.map(toViolationDto);
  }

  async createViolation(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      violationType: ViolationType;
      penaltyPoints: number;
      bookingItemId?: string | null;
      description?: string | null;
      recordedByUserId?: string | null;
    }
  ): Promise<ViolationCreationResult> {
    if (input.bookingItemId) {
      const existing = await tx.violation.findFirst({
        where: {
          bookingItemId: input.bookingItemId,
          violationType: input.violationType
        },
        include: violationInclude
      });

      if (existing) {
        return {
          violation: toViolationDto(existing),
          created: false,
          restrictedUser: false
        };
      }
    }

    const user = await tx.user.findUnique({
      where: { userId: input.userId },
      select: {
        userId: true,
        violationPoints: true,
        bookingPermissionStatus: true,
        bookingLockedUntil: true
      }
    });

    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    const bookingRule = await new RulesRepository(tx).getBookingRuleForPolicy();
    const nextViolationPoints = Math.max(0, user.violationPoints + input.penaltyPoints);
    const shouldRestrictUser = nextViolationPoints >= bookingRule.violationThreshold;
    const bookingLockedUntil =
      shouldRestrictUser && bookingRule.bookingBanDays > 0
        ? addDays(this.nowProvider(), bookingRule.bookingBanDays)
        : null;

    const violation = await tx.violation.create({
      data: {
        userId: input.userId,
        bookingItemId: input.bookingItemId ?? null,
        violationType: input.violationType,
        penaltyPoints: input.penaltyPoints,
        description: normalizeOptional(input.description),
        recordedByUserId: input.recordedByUserId ?? null
      },
      include: violationInclude
    });

    await tx.user.update({
      where: { userId: input.userId },
      data: {
        violationPoints: nextViolationPoints,
        ...(shouldRestrictUser
          ? {
              bookingPermissionStatus: BookingPermissionStatus.RESTRICTED,
              bookingLockedUntil
            }
          : {})
      }
    });

    await this.notifications.createViolationNotification(tx, {
      userId: input.userId,
      bookingOrderId: violation.bookingItem?.bookingOrderId ?? null,
      bookingItemId: input.bookingItemId ?? null,
      notificationType: NotificationType.VIOLATION_RECORDED,
      title: "Violation recorded",
      content: `A ${input.violationType} violation was recorded on your account.`
    });

    if (shouldRestrictUser) {
      await this.notifications.createViolationNotification(tx, {
        userId: input.userId,
        bookingOrderId: violation.bookingItem?.bookingOrderId ?? null,
        bookingItemId: input.bookingItemId ?? null,
        notificationType: NotificationType.BOOKING_PERMISSION_RESTRICTED,
        title: "Booking permission restricted",
        content: "Your booking permission has been restricted due to policy violations."
      });
    }

    return {
      violation: toViolationDto(violation),
      created: true,
      restrictedUser: shouldRestrictUser
    };
  }

  async createLateCancelViolationIfNeeded(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      items: Array<{
        bookingItemId: string;
        startDatetime: Date;
        bookingStatus: BookingStatus;
      }>;
      reason?: string | null;
    }
  ): Promise<ViolationCreationResult | null> {
    const config = await new RulesRepository(tx).getLateCancellationViolationConfig();

    if (!config.enabled) {
      return null;
    }

    const targetItem = input.items
      .filter((item) => item.bookingStatus === BookingStatus.CONFIRMED)
      .sort((a, b) => a.startDatetime.getTime() - b.startDatetime.getTime())[0];

    if (!targetItem) {
      return null;
    }

    return this.createViolation(tx, {
      userId: input.userId,
      bookingItemId: targetItem.bookingItemId,
      violationType: ViolationType.LATE_CANCEL,
      penaltyPoints: config.penaltyPoints,
      description: input.reason ?? "User cancelled booking after configured cancellation window",
      recordedByUserId: input.userId
    });
  }

  async waiveViolation(
    violationId: string,
    input: WaiveViolationInput,
    audit: AuditContext
  ) {
    const now = this.nowProvider();

    try {
      const violation = await this.db.$transaction(
        async (tx) => {
          const currentViolation = await this.getViolationOrThrow(tx, violationId);

          if (currentViolation.isWaived) {
            throw new AppError(409, "Violation is already waived", "VIOLATION_ALREADY_WAIVED");
          }

          const pointResult = await this.applyViolationPointDelta(tx, {
            userId: currentViolation.userId,
            delta: -currentViolation.penaltyPoints,
            now
          });
          const updatedViolation = await tx.violation.update({
            where: { violationId },
            data: {
              isWaived: true
            },
            include: violationInclude
          });

          await this.createAuditLog(tx, audit, {
            entityType: "VIOLATION",
            entityId: currentViolation.violationId,
            action: "WAIVE_VIOLATION",
            oldValue: {
              isWaived: currentViolation.isWaived,
              penaltyPoints: currentViolation.penaltyPoints,
              userViolationPoints: pointResult.oldViolationPoints
            },
            newValue: {
              isWaived: true,
              reason: input.reason,
              userViolationPoints: pointResult.newViolationPoints
            }
          });

          if (pointResult.bookingPermissionChanged) {
            await this.createAuditLog(tx, audit, {
              entityType: "USER",
              entityId: currentViolation.userId,
              action: "UPDATE_BOOKING_PERMISSION_AFTER_VIOLATION_WAIVE",
              oldValue: {
                bookingPermissionStatus: pointResult.oldBookingPermissionStatus,
                bookingLockedUntil: pointResult.oldBookingLockedUntil
              },
              newValue: {
                bookingPermissionStatus: pointResult.newBookingPermissionStatus,
                bookingLockedUntil: pointResult.newBookingLockedUntil,
                reason: input.reason
              }
            });
          }

          return updatedViolation;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toViolationDto(violation);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async adjustViolationPoints(
    violationId: string,
    input: AdjustViolationPointsInput,
    audit: AuditContext
  ) {
    const now = this.nowProvider();

    try {
      const violation = await this.db.$transaction(
        async (tx) => {
          const currentViolation = await this.getViolationOrThrow(tx, violationId);
          const delta = currentViolation.isWaived
            ? 0
            : input.penaltyPoints - currentViolation.penaltyPoints;
          const pointResult = await this.applyViolationPointDelta(tx, {
            userId: currentViolation.userId,
            delta,
            now
          });
          const updatedViolation = await tx.violation.update({
            where: { violationId },
            data: {
              penaltyPoints: input.penaltyPoints
            },
            include: violationInclude
          });

          await this.createAuditLog(tx, audit, {
            entityType: "VIOLATION",
            entityId: currentViolation.violationId,
            action: "ADJUST_VIOLATION_POINTS",
            oldValue: {
              penaltyPoints: currentViolation.penaltyPoints,
              isWaived: currentViolation.isWaived,
              userViolationPoints: pointResult.oldViolationPoints
            },
            newValue: {
              penaltyPoints: input.penaltyPoints,
              delta,
              reason: input.reason,
              userViolationPoints: pointResult.newViolationPoints
            }
          });

          if (pointResult.bookingPermissionChanged) {
            await this.createAuditLog(tx, audit, {
              entityType: "USER",
              entityId: currentViolation.userId,
              action: "UPDATE_BOOKING_PERMISSION_AFTER_VIOLATION_ADJUST",
              oldValue: {
                bookingPermissionStatus: pointResult.oldBookingPermissionStatus,
                bookingLockedUntil: pointResult.oldBookingLockedUntil
              },
              newValue: {
                bookingPermissionStatus: pointResult.newBookingPermissionStatus,
                bookingLockedUntil: pointResult.newBookingLockedUntil,
                reason: input.reason
              }
            });
          }

          if (pointResult.restrictedUser) {
            await this.notifications.createViolationNotification(tx, {
              userId: currentViolation.userId,
              bookingOrderId: currentViolation.bookingItem?.bookingOrderId ?? null,
              bookingItemId: currentViolation.bookingItemId,
              notificationType: NotificationType.BOOKING_PERMISSION_RESTRICTED,
              title: "Booking permission restricted",
              content: "Your booking permission has been restricted due to policy violations."
            });
          }

          return updatedViolation;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toViolationDto(violation);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  private async getViolationOrThrow(
    db: ViolationDbClient,
    violationId: string
  ): Promise<ViolationWithRelations> {
    const violation = await db.violation.findUnique({
      where: { violationId },
      include: violationInclude
    });

    if (!violation) {
      throw new AppError(404, "Violation not found", "VIOLATION_NOT_FOUND");
    }

    return violation;
  }

  private async applyViolationPointDelta(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      delta: number;
      now: Date;
    }
  ) {
    const user = await tx.user.findUnique({
      where: { userId: input.userId },
      select: {
        violationPoints: true,
        bookingPermissionStatus: true,
        bookingLockedUntil: true
      }
    });

    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    const bookingRule = await new RulesRepository(tx).getBookingRuleForPolicy();
    const newViolationPoints = Math.max(0, user.violationPoints + input.delta);
    const shouldRestrictUser = newViolationPoints >= bookingRule.violationThreshold;
    const shouldReleaseUser =
      newViolationPoints < bookingRule.violationThreshold &&
      user.bookingPermissionStatus === BookingPermissionStatus.RESTRICTED &&
      (!user.bookingLockedUntil || user.bookingLockedUntil <= input.now);
    const bookingLockedUntil =
      shouldRestrictUser && bookingRule.bookingBanDays > 0
        ? addDays(input.now, bookingRule.bookingBanDays)
        : user.bookingLockedUntil;
    const newBookingPermissionStatus = shouldRestrictUser
      ? BookingPermissionStatus.RESTRICTED
      : shouldReleaseUser
        ? BookingPermissionStatus.ALLOWED
        : user.bookingPermissionStatus;
    const newBookingLockedUntil = shouldRestrictUser
      ? bookingLockedUntil
      : shouldReleaseUser
        ? null
        : user.bookingLockedUntil;

    await tx.user.update({
      where: { userId: input.userId },
      data: {
        violationPoints: newViolationPoints,
        bookingPermissionStatus: newBookingPermissionStatus,
        bookingLockedUntil: newBookingLockedUntil
      }
    });

    return {
      oldViolationPoints: user.violationPoints,
      newViolationPoints,
      oldBookingPermissionStatus: user.bookingPermissionStatus,
      newBookingPermissionStatus,
      oldBookingLockedUntil: user.bookingLockedUntil,
      newBookingLockedUntil,
      bookingPermissionChanged:
        user.bookingPermissionStatus !== newBookingPermissionStatus ||
        user.bookingLockedUntil?.getTime() !== newBookingLockedUntil?.getTime(),
      restrictedUser:
        user.bookingPermissionStatus !== BookingPermissionStatus.RESTRICTED && shouldRestrictUser
    };
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

export const violationsService = new ViolationsService();
