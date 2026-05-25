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
  bookingOrder: {
    include: {
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
            select: {
              courtId: true,
              courtName: true
            }
          }
        },
        orderBy: {
          startDatetime: "asc" as const
        }
      }
    }
  },
  bookingItem: {
    include: {
      court: {
        select: {
          courtId: true,
          courtName: true
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

const managerCancelOrderInclude = {
  user: {
    include: {
      priorityGroup: true
    }
  },
  items: {
    include: {
      court: {
        select: {
          courtId: true,
          courtName: true
        }
      }
    },
    orderBy: {
      startDatetime: "asc" as const
    }
  },
  payments: {
    orderBy: {
      createdAt: "desc" as const
    }
  }
} satisfies Prisma.BookingOrderInclude;

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
const managerCancellableItemStatuses: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_USE
];

type RefundWithRelations = Prisma.RefundGetPayload<{ include: typeof refundInclude }>;
type ManagerCancelOrder = Prisma.BookingOrderGetPayload<{
  include: typeof managerCancelOrderInclude;
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
    bookingOrderId: refund.bookingOrderId,
    bookingItemId: refund.bookingItemId,
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
    bookingOrder: {
      id: refund.bookingOrder.bookingOrderId,
      bookingOrderId: refund.bookingOrder.bookingOrderId,
      bookingCode: refund.bookingOrder.bookingCode,
      bookingStatus: refund.bookingOrder.bookingStatus,
      paymentStatus: refund.bookingOrder.paymentStatus,
      totalAmount: decimalToNumber(refund.bookingOrder.totalAmount),
      user: {
        id: refund.bookingOrder.user.userId,
        fullName: refund.bookingOrder.user.fullName,
        email: refund.bookingOrder.user.email
      },
      items: refund.bookingOrder.items.map((item) => ({
        id: item.bookingItemId,
        bookingItemId: item.bookingItemId,
        startDatetime: item.startDatetime,
        endDatetime: item.endDatetime,
        amount: decimalToNumber(item.amount),
        bookingStatus: item.bookingStatus,
        court: {
          id: item.court.courtId,
          courtName: item.court.courtName
        }
      }))
    },
    bookingItem: refund.bookingItem
      ? {
          id: refund.bookingItem.bookingItemId,
          bookingItemId: refund.bookingItem.bookingItemId,
          startDatetime: refund.bookingItem.startDatetime,
          endDatetime: refund.bookingItem.endDatetime,
          amount: decimalToNumber(refund.bookingItem.amount),
          bookingStatus: refund.bookingItem.bookingStatus,
          court: {
            id: refund.bookingItem.court.courtId,
            courtName: refund.bookingItem.court.courtName
          }
        }
      : null,
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

function toCancelledOrderDto(order: ManagerCancelOrder) {
  return {
    id: order.bookingOrderId,
    bookingOrderId: order.bookingOrderId,
    bookingCode: order.bookingCode,
    bookingStatus: order.bookingStatus,
    paymentStatus: order.paymentStatus,
    totalAmount: decimalToNumber(order.totalAmount),
    refundable: order.refundable,
    cancelReason: order.cancelReason,
    cancelledByUserId: order.cancelledByUserId,
    cancelledAt: order.cancelledAt,
    user: {
      id: order.user.userId,
      fullName: order.user.fullName,
      email: order.user.email
    },
    items: order.items.map((item) => ({
      id: item.bookingItemId,
      bookingItemId: item.bookingItemId,
      startDatetime: item.startDatetime,
      endDatetime: item.endDatetime,
      amount: decimalToNumber(item.amount),
      bookingStatus: item.bookingStatus,
      court: {
        id: item.court.courtId,
        courtName: item.court.courtName
      }
    }))
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
      bookingOrderId: string;
      bookingItemId?: string | null;
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
        bookingOrderId: input.bookingOrderId,
        bookingItemId: input.bookingItemId ?? null,
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
        bookingOrderId: input.bookingOrderId,
        bookingItemId: input.bookingItemId ?? null,
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
              bookingOrder: {
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
    bookingOrderId: string,
    input: ManagerCancelBookingInput,
    audit: AuditContext
  ) {
    const now = this.nowProvider();

    try {
      const result = await this.db.$transaction(
        async (tx) => {
          const currentOrder = await tx.bookingOrder.findUnique({
            where: { bookingOrderId },
            include: managerCancelOrderInclude
          });

          if (!currentOrder) {
            throw new AppError(404, "Booking order not found", "BOOKING_NOT_FOUND");
          }

          this.assertManagerCanCancelBooking(currentOrder.bookingStatus);

          const adminActor = isAdmin(audit.roles);
          const newStatus = adminActor
            ? BookingStatus.CANCELLED_BY_ADMIN
            : BookingStatus.CANCELLED_BY_MANAGER;
          const actionType = adminActor ? "ADMIN_CANCEL_BOOKING" : "MANAGER_CANCEL_BOOKING";
          const policy = await new RulesRepository(tx).getEffectivePolicy({
            priorityGroupId: currentOrder.user.priorityGroupId,
            priorityGroupAdvanceBookingDays:
              currentOrder.user.priorityGroup?.advanceBookingDays ?? null
          });
          const successfulPayment = currentOrder.payments.find(
            (payment) => payment.paymentStatus === PaymentStatus.SUCCESS
          );
          const refundResult = await this.createRefundForBooking(tx, {
            bookingOrderId: currentOrder.bookingOrderId,
            bookingStatus: currentOrder.bookingStatus,
            payment: successfulPayment ?? null,
            refundRate: policy.refundRateManagerFault,
            refundReason: input.reason,
            requestedByUserId: audit.actorUserId
          });
          const cancellableItems = currentOrder.items.filter((item) =>
            managerCancellableItemStatuses.includes(item.bookingStatus)
          );

          const updatedOrder = await tx.bookingOrder.update({
            where: { bookingOrderId: currentOrder.bookingOrderId },
            data: {
              bookingStatus: newStatus,
              refundable: refundResult !== null,
              cancelReason: normalizeOptional(input.reason),
              cancelledByUserId: audit.actorUserId,
              cancelledAt: now,
              holdExpiresAt: null
            },
            include: managerCancelOrderInclude
          });

          await tx.bookingItem.updateMany({
            where: {
              bookingOrderId: currentOrder.bookingOrderId,
              bookingStatus: {
                in: managerCancellableItemStatuses
              }
            },
            data: {
              bookingStatus: newStatus,
              managerNote: normalizeOptional(input.reason)
            }
          });

          await this.state.recordOrderStatusHistory(tx, {
            bookingOrderId: currentOrder.bookingOrderId,
            oldStatus: currentOrder.bookingStatus,
            newStatus,
            actionType,
            actionByUserId: audit.actorUserId,
            note: input.reason
          });

          for (const item of cancellableItems) {
            await this.state.recordItemStatusHistory(tx, {
              bookingItemId: item.bookingItemId,
              oldStatus: item.bookingStatus,
              newStatus,
              actionType,
              actionByUserId: audit.actorUserId,
              note: input.reason
            });
          }

          await this.createAuditLog(tx, audit, {
            entityType: "BOOKING_ORDER",
            entityId: currentOrder.bookingOrderId,
            action: actionType,
            oldValue: {
              bookingStatus: currentOrder.bookingStatus,
              refundable: currentOrder.refundable
            },
            newValue: {
              bookingStatus: newStatus,
              reason: input.reason,
              refundId: refundResult?.refundId ?? null,
              refundCreated: refundResult?.created ?? false
            }
          });

          return {
            order: updatedOrder,
            refundId: refundResult?.refundId ?? null
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return {
        bookingOrder: toCancelledOrderDto(result.order),
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
      "Booking order cannot be cancelled by manager/admin in its current status",
      "BOOKING_CANNOT_BE_CANCELLED_BY_MANAGER"
    );
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
