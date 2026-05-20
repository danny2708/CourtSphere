import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RefundStatus
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { bookingStateService, type BookingStateService } from "../bookings/booking-state.service";
import { RulesRepository } from "../rules/rules.repository";
import {
  mockRefundGateway,
  type MockRefundGateway
} from "./refund-gateway.mock";
import type {
  AdminListRefundsQuery,
  AuditContext,
  ManagerCancelBookingInput,
  RetryRefundInput
} from "./refunds.types";

const refundInclude = {
  payment: true,
  booking: {
    include: {
      user: {
        select: {
          userId: true,
          fullName: true,
          email: true
        }
      },
      court: {
        select: {
          courtId: true,
          courtName: true,
          location: true
        }
      }
    }
  },
  requestedBy: {
    select: {
      userId: true,
      fullName: true,
      email: true
    }
  },
  processedBy: {
    select: {
      userId: true,
      fullName: true,
      email: true
    }
  }
} satisfies Prisma.RefundInclude;

const managerCancelBookingInclude = {
  user: {
    include: {
      priorityGroup: true
    }
  },
  court: {
    select: {
      courtId: true,
      courtName: true,
      location: true
    }
  },
  payments: {
    orderBy: {
      createdAt: "desc" as const
    }
  }
} satisfies Prisma.BookingInclude;

const retryableRefundStatuses: RefundStatus[] = [
  RefundStatus.FAILED,
  RefundStatus.MANUAL_REVIEW,
  RefundStatus.REQUESTED
];

const duplicateBlockingRefundStatuses: RefundStatus[] = [
  RefundStatus.REQUESTED,
  RefundStatus.PROCESSING,
  RefundStatus.SUCCESS,
  RefundStatus.MANUAL_REVIEW
];

type RefundWithRelations = Prisma.RefundGetPayload<{ include: typeof refundInclude }>;
type ManagerCancelBooking = Prisma.BookingGetPayload<{
  include: typeof managerCancelBookingInclude;
}>;
type RefundDbClient = PrismaClient | Prisma.TransactionClient;

type PaymentForRefund = {
  paymentId: string;
  amount: Prisma.Decimal;
  paymentStatus: PaymentStatus;
};

export type RefundCreationResult = {
  refundId: string;
  created: boolean;
};

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

function isAdmin(roles: string[]): boolean {
  return roles.includes("ADMIN");
}

function toRefundDto(refund: RefundWithRelations) {
  return {
    id: refund.refundId,
    paymentId: refund.paymentId,
    bookingId: refund.bookingId,
    refundAmount: decimalToNumber(refund.refundAmount),
    refundReason: refund.refundReason,
    refundStatus: refund.refundStatus,
    gatewayRefundId: refund.gatewayRefundId,
    requestedAt: refund.requestedAt,
    processedAt: refund.processedAt,
    updatedAt: refund.updatedAt,
    payment: {
      id: refund.payment.paymentId,
      amount: decimalToNumber(refund.payment.amount),
      paymentStatus: refund.payment.paymentStatus,
      paidAt: refund.payment.paidAt
    },
    booking: {
      id: refund.booking.bookingId,
      bookingCode: refund.booking.bookingCode,
      bookingStatus: refund.booking.bookingStatus,
      paymentStatus: refund.booking.paymentStatus,
      startDatetime: refund.booking.startDatetime,
      endDatetime: refund.booking.endDatetime,
      totalAmount: decimalToNumber(refund.booking.totalAmount),
      user: {
        id: refund.booking.user.userId,
        fullName: refund.booking.user.fullName,
        email: refund.booking.user.email
      },
      court: {
        id: refund.booking.court.courtId,
        courtName: refund.booking.court.courtName,
        location: refund.booking.court.location
      }
    },
    requestedByUser: refund.requestedBy
      ? {
          id: refund.requestedBy.userId,
          fullName: refund.requestedBy.fullName,
          email: refund.requestedBy.email
        }
      : null,
    processedByUser: refund.processedBy
      ? {
          id: refund.processedBy.userId,
          fullName: refund.processedBy.fullName,
          email: refund.processedBy.email
        }
      : null
  };
}

function toCancelledBookingDto(booking: ManagerCancelBooking) {
  return {
    id: booking.bookingId,
    bookingCode: booking.bookingCode,
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    startDatetime: booking.startDatetime,
    endDatetime: booking.endDatetime,
    totalAmount: decimalToNumber(booking.totalAmount),
    refundable: booking.refundable,
    noRefundReason: booking.noRefundReason,
    cancelReason: booking.cancelReason,
    cancelledByUserId: booking.cancelledByUserId,
    cancelledAt: booking.cancelledAt,
    user: {
      id: booking.user.userId,
      fullName: booking.user.fullName,
      email: booking.user.email
    },
    court: {
      id: booking.court.courtId,
      courtName: booking.court.courtName,
      location: booking.court.location
    }
  };
}

function auditActionForRefundStatus(status: RefundStatus): string {
  if (status === RefundStatus.SUCCESS) {
    return "REFUND_SUCCESS";
  }

  if (status === RefundStatus.MANUAL_REVIEW) {
    return "REFUND_MANUAL_REVIEW";
  }

  return "REFUND_FAILED";
}

function handleKnownPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "Refund already exists", "REFUND_ALREADY_EXISTS");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2034") {
      throw new AppError(409, "Refund transaction conflicted, please retry", "REFUND_RETRY_REQUIRED");
    }
  }

  throw error;
}

export class RefundsService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly gateway: MockRefundGateway = mockRefundGateway,
    private readonly state: BookingStateService = bookingStateService,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  calculateRefundAmount(paymentAmount: Prisma.Decimal, refundRate: number): Prisma.Decimal {
    return paymentAmount.mul(refundRate).div(100).toDecimalPlaces(2);
  }

  async createRefundForBooking(
    tx: Prisma.TransactionClient,
    input: {
      bookingId: string;
      bookingStatus: BookingStatus;
      payment: PaymentForRefund | null | undefined;
      refundRate: number;
      refundReason: string;
      requestedByUserId?: string | null;
    }
  ): Promise<RefundCreationResult | null> {
    if (
      input.bookingStatus === BookingStatus.CHECKIN_EXPIRED ||
      input.bookingStatus === BookingStatus.NO_SHOW
    ) {
      return null;
    }

    if (!input.payment || input.payment.paymentStatus !== PaymentStatus.SUCCESS) {
      return null;
    }

    if (input.refundRate <= 0) {
      return null;
    }

    const existingRefund = await tx.refund.findFirst({
      where: {
        bookingId: input.bookingId,
        paymentId: input.payment.paymentId,
        refundStatus: {
          in: duplicateBlockingRefundStatuses
        }
      },
      select: {
        refundId: true
      }
    });

    if (existingRefund) {
      return {
        refundId: existingRefund.refundId,
        created: false
      };
    }

    const refundAmount = this.calculateRefundAmount(input.payment.amount, input.refundRate);
    if (refundAmount.lte(0)) {
      return null;
    }

    const refund = await tx.refund.create({
      data: {
        paymentId: input.payment.paymentId,
        bookingId: input.bookingId,
        refundAmount,
        refundReason: input.refundReason,
        refundStatus: RefundStatus.REQUESTED,
        requestedByUserId: input.requestedByUserId ?? null
      },
      select: {
        refundId: true
      }
    });

    return {
      refundId: refund.refundId,
      created: true
    };
  }

  async listRefundsForAdmin(query: AdminListRefundsQuery) {
    const refunds = await this.db.refund.findMany({
      where: {
        ...(query.refundStatus ? { refundStatus: query.refundStatus } : {}),
        ...(query.paymentId ? { paymentId: query.paymentId } : {}),
        ...(query.fromDate || query.toDate
          ? {
              requestedAt: {
                ...(query.fromDate ? { gte: query.fromDate } : {}),
                ...(query.toDate ? { lte: query.toDate } : {})
              }
            }
          : {}),
        ...(query.userId || query.bookingCode
          ? {
              booking: {
                ...(query.userId ? { userId: query.userId } : {}),
                ...(query.bookingCode
                  ? {
                      bookingCode: {
                        contains: query.bookingCode,
                        mode: "insensitive" as const
                      }
                    }
                  : {})
              }
            }
          : {})
      },
      include: refundInclude,
      orderBy: [{ requestedAt: "desc" }]
    });

    return refunds.map(toRefundDto);
  }

  async getRefundDetailForAdmin(refundId: string) {
    return toRefundDto(await this.getRefundOrThrow(refundId));
  }

  async retryRefund(refundId: string, input: RetryRefundInput, audit: AuditContext) {
    const now = this.nowProvider();

    try {
      const refund = await this.db.$transaction(async (tx) => {
        const currentRefund = await tx.refund.findUnique({
          where: { refundId },
          include: refundInclude
        });

        if (!currentRefund) {
          throw new AppError(404, "Refund not found", "REFUND_NOT_FOUND");
        }

        if (!retryableRefundStatuses.includes(currentRefund.refundStatus)) {
          throw new AppError(
            409,
            "Refund can only be retried from REQUESTED, FAILED, or MANUAL_REVIEW",
            "REFUND_NOT_RETRYABLE"
          );
        }

        const gatewayResult = this.gateway.processRefund({
          refundId: currentRefund.refundId,
          forcedStatus: input.mockResult
        });
        const updatedRefund =
          gatewayResult.refundStatus === RefundStatus.SUCCESS
            ? await this.markRefundSuccess(tx, {
                refundId: currentRefund.refundId,
                processedByUserId: audit.actorUserId,
                processedAt: now,
                gatewayRefundId: gatewayResult.gatewayRefundId ?? null
              })
            : await this.markRefundFailed(tx, {
                refundId: currentRefund.refundId,
                processedByUserId: audit.actorUserId,
                refundStatus: gatewayResult.refundStatus,
                gatewayRefundId: gatewayResult.gatewayRefundId ?? null
              });

        await this.createAuditLog(tx, audit, {
          entityType: "REFUND",
          entityId: currentRefund.refundId,
          action: "ADMIN_RETRY_REFUND",
          oldValue: {
            refundStatus: currentRefund.refundStatus,
            processedAt: currentRefund.processedAt
          },
          newValue: {
            refundStatus: updatedRefund.refundStatus,
            processedAt: updatedRefund.processedAt,
            reason: input.reason ?? null
          }
        });

        await this.createAuditLog(tx, audit, {
          entityType: "REFUND",
          entityId: currentRefund.refundId,
          action: auditActionForRefundStatus(updatedRefund.refundStatus),
          oldValue: {
            refundStatus: currentRefund.refundStatus
          },
          newValue: {
            refundStatus: updatedRefund.refundStatus,
            gatewayRefundId: updatedRefund.gatewayRefundId
          }
        });

        return updatedRefund;
      });

      return toRefundDto(refund);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async markRefundSuccess(
    db: RefundDbClient,
    input: {
      refundId: string;
      processedByUserId: string;
      processedAt: Date;
      gatewayRefundId?: string | null;
    }
  ): Promise<RefundWithRelations> {
    return db.refund.update({
      where: { refundId: input.refundId },
      data: {
        refundStatus: RefundStatus.SUCCESS,
        processedAt: input.processedAt,
        processedByUserId: input.processedByUserId,
        gatewayRefundId: input.gatewayRefundId ?? undefined
      },
      include: refundInclude
    });
  }

  async markRefundFailed(
    db: RefundDbClient,
    input: {
      refundId: string;
      processedByUserId: string;
      refundStatus: Extract<RefundStatus, "FAILED" | "MANUAL_REVIEW">;
      gatewayRefundId?: string | null;
    }
  ): Promise<RefundWithRelations> {
    return db.refund.update({
      where: { refundId: input.refundId },
      data: {
        refundStatus: input.refundStatus,
        processedByUserId: input.processedByUserId,
        gatewayRefundId: input.gatewayRefundId ?? undefined
      },
      include: refundInclude
    });
  }

  async cancelBookingDueToCourtIssue(
    bookingId: string,
    input: ManagerCancelBookingInput,
    audit: AuditContext
  ) {
    const now = this.nowProvider();

    try {
      const result = await this.db.$transaction(
        async (tx) => {
          const currentBooking = await tx.booking.findUnique({
            where: { bookingId },
            include: managerCancelBookingInclude
          });

          if (!currentBooking) {
            throw new AppError(404, "Booking not found", "BOOKING_NOT_FOUND");
          }

          this.assertManagerCanCancelBooking(currentBooking.bookingStatus);

          const adminActor = isAdmin(audit.roles);
          const newStatus = adminActor
            ? BookingStatus.CANCELLED_BY_ADMIN
            : BookingStatus.CANCELLED_BY_MANAGER;
          const actionType = adminActor ? "ADMIN_CANCEL_BOOKING" : "MANAGER_CANCEL_BOOKING";
          const policy = await new RulesRepository(tx).getEffectivePolicy({
            priorityGroupId: currentBooking.user.priorityGroupId,
            priorityGroupAdvanceBookingDays:
              currentBooking.user.priorityGroup?.advanceBookingDays ?? null
          });
          const successfulPayment = currentBooking.payments.find(
            (payment) => payment.paymentStatus === PaymentStatus.SUCCESS
          );
          const refundResult = await this.createRefundForBooking(tx, {
            bookingId: currentBooking.bookingId,
            bookingStatus: currentBooking.bookingStatus,
            payment: successfulPayment ?? null,
            refundRate: policy.refundRateManagerFault,
            refundReason: input.reason,
            requestedByUserId: audit.actorUserId
          });
          const noRefundReason = this.resolveNoRefundReason({
            payment: successfulPayment ?? null,
            bookingStatus: currentBooking.bookingStatus,
            refundRate: policy.refundRateManagerFault,
            refundCreatedOrExisting: refundResult !== null
          });

          const updatedBooking = await tx.booking.update({
            where: { bookingId: currentBooking.bookingId },
            data: {
              bookingStatus: newStatus,
              refundable: refundResult !== null,
              noRefundReason,
              cancelReason: normalizeOptional(input.reason),
              cancelledByUserId: audit.actorUserId,
              cancelledAt: now,
              holdExpiresAt: null
            },
            include: managerCancelBookingInclude
          });

          await this.state.recordStatusHistory(tx, {
            bookingId: currentBooking.bookingId,
            oldStatus: currentBooking.bookingStatus,
            newStatus,
            actionType,
            actionByUserId: audit.actorUserId,
            note: input.reason
          });

          await this.createAuditLog(tx, audit, {
            entityType: "BOOKING",
            entityId: currentBooking.bookingId,
            action: actionType,
            oldValue: {
              bookingStatus: currentBooking.bookingStatus,
              refundable: currentBooking.refundable,
              noRefundReason: currentBooking.noRefundReason
            },
            newValue: {
              bookingStatus: newStatus,
              reason: input.reason,
              refundId: refundResult?.refundId ?? null,
              refundCreated: refundResult?.created ?? false,
              noRefundReason
            }
          });

          return {
            booking: updatedBooking,
            refundId: refundResult?.refundId ?? null
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return {
        booking: toCancelledBookingDto(result.booking),
        refund: result.refundId ? toRefundDto(await this.getRefundOrThrow(result.refundId)) : null
      };
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  private async getRefundOrThrow(refundId: string): Promise<RefundWithRelations> {
    const refund = await this.db.refund.findUnique({
      where: { refundId },
      include: refundInclude
    });

    if (!refund) {
      throw new AppError(404, "Refund not found", "REFUND_NOT_FOUND");
    }

    return refund;
  }

  private assertManagerCanCancelBooking(status: BookingStatus): void {
    if (status === BookingStatus.CONFIRMED || status === BookingStatus.IN_USE) {
      return;
    }

    throw new AppError(
      409,
      "Booking cannot be cancelled by manager/admin in its current status",
      "BOOKING_CANNOT_BE_CANCELLED_BY_MANAGER"
    );
  }

  private resolveNoRefundReason(input: {
    payment: PaymentForRefund | null;
    bookingStatus: BookingStatus;
    refundRate: number;
    refundCreatedOrExisting: boolean;
  }): string | null {
    if (input.refundCreatedOrExisting) {
      return null;
    }

    if (
      input.bookingStatus === BookingStatus.CHECKIN_EXPIRED ||
      input.bookingStatus === BookingStatus.NO_SHOW
    ) {
      return "Check-in expired and no-show bookings are not refundable";
    }

    if (!input.payment || input.payment.paymentStatus !== PaymentStatus.SUCCESS) {
      return "No successful payment found";
    }

    if (input.refundRate <= 0) {
      return "Manager/admin cancellation refund rate is 0";
    }

    return "Refund amount is 0";
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

export const refundsService = new RefundsService();
