import { BookingStatus, PaymentStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { bookingStateService, type BookingStateService } from "../bookings/booking-state.service";
import {
  mockPaymentGateway,
  type MockPaymentGateway
} from "./payment-gateway.mock";
import type {
  AdminListPaymentsQuery,
  CreatePaymentInput,
  MockPaymentCallbackInput
} from "./payments.types";

const paymentInclude = {
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
            include: {
              courtType: true
            }
          }
        },
        orderBy: {
          startDatetime: "asc" as const
        }
      }
    }
  },
  user: {
    select: {
      userId: true,
      fullName: true,
      email: true
    }
  }
} satisfies Prisma.PaymentInclude;

type PaymentWithRelations = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;
type PaymentOrder = {
  bookingOrderId: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  holdExpiresAt: Date | null;
  totalAmount: Prisma.Decimal;
  items: Array<{
    bookingItemId: string;
    bookingStatus: BookingStatus;
  }>;
};
const terminalPaymentStatuses: PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
  PaymentStatus.EXPIRED
];
const waitingPaymentItemStatuses: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PAYMENT_PROCESSING
];

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function toPaymentDto(payment: PaymentWithRelations, paymentUrl?: string) {
  return {
    id: payment.paymentId,
    amount: decimalToNumber(payment.amount),
    paymentMethod: payment.paymentMethod,
    gatewayTransactionId: payment.gatewayTransactionId,
    paymentStatus: payment.paymentStatus,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    ...(paymentUrl ? { paymentUrl } : {}),
    user: {
      id: payment.user.userId,
      fullName: payment.user.fullName,
      email: payment.user.email
    },
    bookingOrder: {
      id: payment.bookingOrder.bookingOrderId,
      bookingOrderId: payment.bookingOrder.bookingOrderId,
      bookingCode: payment.bookingOrder.bookingCode,
      bookingStatus: payment.bookingOrder.bookingStatus,
      paymentStatus: payment.bookingOrder.paymentStatus,
      totalAmount: decimalToNumber(payment.bookingOrder.totalAmount),
      holdExpiresAt: payment.bookingOrder.holdExpiresAt,
      user: {
        id: payment.bookingOrder.user.userId,
        fullName: payment.bookingOrder.user.fullName,
        email: payment.bookingOrder.user.email
      },
      items: payment.bookingOrder.items.map((item) => ({
        id: item.bookingItemId,
        bookingItemId: item.bookingItemId,
        startDatetime: item.startDatetime,
        endDatetime: item.endDatetime,
        amount: decimalToNumber(item.amount),
        bookingStatus: item.bookingStatus,
        court: {
          id: item.court.courtId,
          courtName: item.court.courtName,
          courtType: {
            id: item.court.courtType.courtTypeId,
            typeName: item.court.courtType.typeName
          }
        }
      }))
    }
  };
}

function isAdmin(roles: string[]): boolean {
  return roles.includes("ADMIN");
}

function isTerminalStatus(status: PaymentStatus): boolean {
  return terminalPaymentStatuses.includes(status);
}

function paymentUrlForGatewayTransaction(gatewayTransactionId: string | null): string | undefined {
  return gatewayTransactionId ? `/mock-payment/${gatewayTransactionId}` : undefined;
}

function handleKnownPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "Payment already exists", "PAYMENT_ALREADY_EXISTS");
    }

    if (error.code === "P2003") {
      throw new AppError(400, "Related resource does not exist", "FOREIGN_KEY_CONSTRAINT_VIOLATION");
    }

    if (error.code === "P2034") {
      throw new AppError(409, "Payment transaction conflicted, please retry", "PAYMENT_RETRY_REQUIRED");
    }
  }

  throw error;
}

export class PaymentsService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly gateway: MockPaymentGateway = mockPaymentGateway,
    private readonly state: BookingStateService = bookingStateService,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async createPaymentForBooking(userId: string, bookingOrderId: string, input: CreatePaymentInput) {
    const now = this.nowProvider();

    try {
      const result = await this.db.$transaction(
        async (tx) => {
          const order = await tx.bookingOrder.findFirst({
            where: {
              bookingOrderId,
              userId
            },
            include: {
              payments: {
                where: {
                  paymentStatus: {
                    in: [PaymentStatus.INITIATED, PaymentStatus.PROCESSING]
                  }
                },
                orderBy: {
                  createdAt: "desc"
                }
              },
              items: {
                select: {
                  bookingItemId: true,
                  bookingStatus: true
                }
              }
            }
          });

          if (!order) {
            throw new AppError(404, "Booking order not found", "BOOKING_NOT_FOUND");
          }

          this.assertOrderCanCreatePayment(order, input.amount, now);

          const existingPayment = order.payments[0];
          if (existingPayment) {
            return {
              paymentId: existingPayment.paymentId,
              paymentUrl: paymentUrlForGatewayTransaction(existingPayment.gatewayTransactionId)
            };
          }

          const gatewayTransaction = this.gateway.createTransaction();
          const payment = await tx.payment.create({
            data: {
              bookingOrderId: order.bookingOrderId,
              userId,
              amount: order.totalAmount,
              paymentMethod: "MOCK",
              gatewayTransactionId: gatewayTransaction.gatewayTransactionId,
              paymentStatus: PaymentStatus.PROCESSING
            },
            select: {
              paymentId: true
            }
          });

          if (order.bookingStatus === BookingStatus.PENDING_PAYMENT) {
            await tx.bookingOrder.update({
              where: { bookingOrderId: order.bookingOrderId },
              data: {
                bookingStatus: BookingStatus.PAYMENT_PROCESSING,
                paymentStatus: PaymentStatus.PROCESSING
              }
            });
            await tx.bookingItem.updateMany({
              where: {
                bookingOrderId: order.bookingOrderId,
                bookingStatus: BookingStatus.PENDING_PAYMENT
              },
              data: {
                bookingStatus: BookingStatus.PAYMENT_PROCESSING
              }
            });

            await this.state.recordOrderStatusHistory(tx, {
              bookingOrderId: order.bookingOrderId,
              oldStatus: BookingStatus.PENDING_PAYMENT,
              newStatus: BookingStatus.PAYMENT_PROCESSING,
              actionType: "USER_CREATE_PAYMENT",
              actionByUserId: userId,
              note: "Mock payment created, waiting for callback"
            });

            for (const item of order.items.filter(
              (bookingItem) => bookingItem.bookingStatus === BookingStatus.PENDING_PAYMENT
            )) {
              await this.state.recordItemStatusHistory(tx, {
                bookingItemId: item.bookingItemId,
                oldStatus: BookingStatus.PENDING_PAYMENT,
                newStatus: BookingStatus.PAYMENT_PROCESSING,
                actionType: "USER_CREATE_PAYMENT",
                actionByUserId: userId,
                note: "Mock payment created, waiting for callback"
              });
            }
          } else {
            await tx.bookingOrder.update({
              where: { bookingOrderId: order.bookingOrderId },
              data: {
                paymentStatus: PaymentStatus.PROCESSING
              }
            });
          }

          return {
            paymentId: payment.paymentId,
            paymentUrl: gatewayTransaction.paymentUrl
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
      const payment = await this.getPaymentOrThrow(result.paymentId);

      return toPaymentDto(payment, result.paymentUrl);
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async handleMockCallback(input: MockPaymentCallbackInput) {
    if (!this.gateway.verify(input)) {
      throw new AppError(401, "Invalid mock payment signature", "INVALID_PAYMENT_SIGNATURE");
    }

    const now = this.nowProvider();

    try {
      const paymentId = await this.db.$transaction(
        async (tx) => {
          const payment = await tx.payment.findUnique({
            where: {
              gatewayTransactionId: input.gatewayTransactionId
            },
            include: {
              bookingOrder: {
                include: {
                  items: {
                    select: {
                      bookingItemId: true,
                      bookingStatus: true
                    }
                  }
                }
              }
            }
          });

          if (!payment) {
            throw new AppError(404, "Payment not found", "PAYMENT_NOT_FOUND");
          }

          if (isTerminalStatus(payment.paymentStatus)) {
            if (payment.paymentStatus === input.status) {
              return payment.paymentId;
            }

            throw new AppError(
              409,
              "Payment is already terminal and cannot be changed",
              "PAYMENT_ALREADY_TERMINAL"
            );
          }

          if (input.status === PaymentStatus.SUCCESS) {
            if (payment.bookingOrder.holdExpiresAt && payment.bookingOrder.holdExpiresAt <= now) {
              await tx.payment.update({
                where: { paymentId: payment.paymentId },
                data: {
                  paymentStatus: PaymentStatus.EXPIRED,
                  rawCallback: input,
                  paidAt: null
                }
              });
              await this.expireOrderIfStillWaiting(tx, payment.bookingOrder, now);

              return payment.paymentId;
            }

            await tx.payment.update({
              where: { paymentId: payment.paymentId },
              data: {
                paymentStatus: PaymentStatus.SUCCESS,
                rawCallback: input,
                paidAt: now
              }
            });

            if (
              payment.bookingOrder.bookingStatus === BookingStatus.PENDING_PAYMENT ||
              payment.bookingOrder.bookingStatus === BookingStatus.PAYMENT_PROCESSING
            ) {
              await tx.bookingOrder.update({
                where: { bookingOrderId: payment.bookingOrderId },
                data: {
                  bookingStatus: BookingStatus.CONFIRMED,
                  paymentStatus: PaymentStatus.SUCCESS,
                  holdExpiresAt: null
                }
              });
              await tx.bookingItem.updateMany({
                where: {
                  bookingOrderId: payment.bookingOrderId,
                  bookingStatus: {
                    in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_PROCESSING]
                  }
                },
                data: {
                  bookingStatus: BookingStatus.CONFIRMED
                }
              });

              await this.state.recordOrderStatusHistory(tx, {
                bookingOrderId: payment.bookingOrderId,
                oldStatus: payment.bookingOrder.bookingStatus,
                newStatus: BookingStatus.CONFIRMED,
                actionType: "PAYMENT_SUCCESS_CONFIRM_BOOKING",
                note: "Thanh toan thanh cong, booking order duoc xac nhan"
              });

              for (const item of payment.bookingOrder.items.filter((bookingItem) =>
                waitingPaymentItemStatuses.includes(bookingItem.bookingStatus)
              )) {
                await this.state.recordItemStatusHistory(tx, {
                  bookingItemId: item.bookingItemId,
                  oldStatus: item.bookingStatus,
                  newStatus: BookingStatus.CONFIRMED,
                  actionType: "PAYMENT_SUCCESS_CONFIRM_BOOKING_ITEM",
                  note: "Thanh toan thanh cong, booking item duoc xac nhan"
                });
              }
            }

            return payment.paymentId;
          }

          await tx.payment.update({
            where: { paymentId: payment.paymentId },
            data: {
              paymentStatus: input.status,
              rawCallback: input
            }
          });
          await tx.bookingOrder.update({
            where: { bookingOrderId: payment.bookingOrderId },
            data: {
              paymentStatus: input.status
            }
          });

          if (
            input.status === PaymentStatus.EXPIRED ||
            (payment.bookingOrder.holdExpiresAt && payment.bookingOrder.holdExpiresAt <= now)
          ) {
            await this.expireOrderIfStillWaiting(tx, payment.bookingOrder, now);
          }

          return payment.paymentId;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );

      return toPaymentDto(await this.getPaymentOrThrow(paymentId));
    } catch (error) {
      return handleKnownPrismaError(error);
    }
  }

  async getPaymentDetail(requester: { userId: string; roles: string[] }, paymentId: string) {
    const payment = await this.getPaymentOrThrow(paymentId);

    if (!isAdmin(requester.roles) && payment.userId !== requester.userId) {
      throw new AppError(403, "Cannot access another user's payment", "PAYMENT_FORBIDDEN");
    }

    return toPaymentDto(payment);
  }

  async listPaymentsForAdmin(query: AdminListPaymentsQuery) {
    const payments = await this.db.payment.findMany({
      where: {
        ...(query.status ? { paymentStatus: query.status } : {}),
        ...(query.userId ? { userId: query.userId } : {}),
        ...(query.fromDate || query.toDate
          ? {
              createdAt: {
                ...(query.fromDate ? { gte: query.fromDate } : {}),
                ...(query.toDate ? { lte: query.toDate } : {})
              }
            }
          : {}),
        ...(query.bookingCode
          ? {
              bookingOrder: {
                bookingCode: {
                  contains: query.bookingCode,
                  mode: "insensitive"
                }
              }
            }
          : {})
      },
      include: paymentInclude,
      orderBy: [{ createdAt: "desc" }]
    });

    return payments.map((payment) => toPaymentDto(payment));
  }

  private async getPaymentOrThrow(paymentId: string): Promise<PaymentWithRelations> {
    const payment = await this.db.payment.findUnique({
      where: { paymentId },
      include: paymentInclude
    });

    if (!payment) {
      throw new AppError(404, "Payment not found", "PAYMENT_NOT_FOUND");
    }

    return payment;
  }

  private assertOrderCanCreatePayment(order: PaymentOrder, amount: number, now: Date): void {
    if (
      order.bookingStatus !== BookingStatus.PENDING_PAYMENT &&
      order.bookingStatus !== BookingStatus.PAYMENT_PROCESSING
    ) {
      throw new AppError(
        409,
        "Payment can only be created for pending-payment booking orders",
        "BOOKING_NOT_PAYABLE"
      );
    }

    if (!order.holdExpiresAt || order.holdExpiresAt <= now) {
      throw new AppError(409, "Booking payment hold has expired", "BOOKING_HOLD_EXPIRED");
    }

    if (!new Prisma.Decimal(amount).equals(order.totalAmount)) {
      throw new AppError(400, "Payment amount must equal booking total amount", "PAYMENT_AMOUNT_MISMATCH");
    }
  }

  private async expireOrderIfStillWaiting(
    tx: Prisma.TransactionClient,
    order: PaymentOrder,
    now: Date
  ): Promise<void> {
    if (
      order.bookingStatus !== BookingStatus.PENDING_PAYMENT &&
      order.bookingStatus !== BookingStatus.PAYMENT_PROCESSING
    ) {
      return;
    }

    const updatedOrder = await tx.bookingOrder.updateMany({
      where: {
        bookingOrderId: order.bookingOrderId,
        bookingStatus: {
          in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_PROCESSING]
        }
      },
      data: {
        bookingStatus: BookingStatus.PAYMENT_EXPIRED,
        paymentStatus: PaymentStatus.EXPIRED,
        refundable: false
      }
    });

    if (updatedOrder.count === 0) {
      return;
    }

    await tx.bookingItem.updateMany({
      where: {
        bookingOrderId: order.bookingOrderId,
        bookingStatus: {
          in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_PROCESSING]
        }
      },
      data: {
        bookingStatus: BookingStatus.PAYMENT_EXPIRED
      }
    });

    await this.state.recordOrderStatusHistory(tx, {
      bookingOrderId: order.bookingOrderId,
      oldStatus: order.bookingStatus,
      newStatus: BookingStatus.PAYMENT_EXPIRED,
      actionType: "PAYMENT_CALLBACK_EXPIRED_HOLD",
      note: `Payment callback processed after hold expired at ${now.toISOString()}`
    });

    for (const item of order.items.filter((bookingItem) =>
      waitingPaymentItemStatuses.includes(bookingItem.bookingStatus)
    )) {
      await this.state.recordItemStatusHistory(tx, {
        bookingItemId: item.bookingItemId,
        oldStatus: item.bookingStatus,
        newStatus: BookingStatus.PAYMENT_EXPIRED,
        actionType: "PAYMENT_CALLBACK_EXPIRED_HOLD",
        note: `Payment callback processed after hold expired at ${now.toISOString()}`
      });
    }
  }
}

export const paymentsService = new PaymentsService();
