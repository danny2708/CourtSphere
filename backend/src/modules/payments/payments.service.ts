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
  booking: {
    include: {
      court: {
        include: {
          courtType: true
        }
      },
      user: {
        select: {
          userId: true,
          fullName: true,
          email: true
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
    booking: {
      id: payment.booking.bookingId,
      bookingCode: payment.booking.bookingCode,
      bookingStatus: payment.booking.bookingStatus,
      paymentStatus: payment.booking.paymentStatus,
      startDatetime: payment.booking.startDatetime,
      endDatetime: payment.booking.endDatetime,
      totalAmount: decimalToNumber(payment.booking.totalAmount),
      holdExpiresAt: payment.booking.holdExpiresAt,
      court: {
        id: payment.booking.court.courtId,
        courtName: payment.booking.court.courtName,
        location: payment.booking.court.location,
        courtType: {
          id: payment.booking.court.courtType.courtTypeId,
          typeName: payment.booking.court.courtType.typeName
        }
      }
    }
  };
}

function isAdmin(roles: string[]): boolean {
  return roles.includes("ADMIN");
}

function isTerminalStatus(status: PaymentStatus): boolean {
  const terminalStatuses: PaymentStatus[] = [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED
  ];

  return terminalStatuses.includes(status);
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

  async createPaymentForBooking(userId: string, bookingId: string, input: CreatePaymentInput) {
    const now = this.nowProvider();

    try {
      const result = await this.db.$transaction(
        async (tx) => {
          const booking = await tx.booking.findFirst({
            where: {
              bookingId,
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
              }
            }
          });

          if (!booking) {
            throw new AppError(404, "Booking not found", "BOOKING_NOT_FOUND");
          }

          this.assertBookingCanCreatePayment(booking, input.amount, now);

          const existingPayment = booking.payments[0];
          if (existingPayment) {
            return {
              paymentId: existingPayment.paymentId,
              paymentUrl: paymentUrlForGatewayTransaction(existingPayment.gatewayTransactionId)
            };
          }

          const gatewayTransaction = this.gateway.createTransaction();
          const payment = await tx.payment.create({
            data: {
              bookingId: booking.bookingId,
              userId,
              amount: booking.totalAmount,
              paymentMethod: "MOCK",
              gatewayTransactionId: gatewayTransaction.gatewayTransactionId,
              paymentStatus: PaymentStatus.PROCESSING
            },
            select: {
              paymentId: true
            }
          });

          if (booking.bookingStatus === BookingStatus.PENDING_PAYMENT) {
            await tx.booking.update({
              where: { bookingId: booking.bookingId },
              data: {
                bookingStatus: BookingStatus.PAYMENT_PROCESSING,
                paymentStatus: PaymentStatus.PROCESSING
              }
            });

            await this.state.recordStatusHistory(tx, {
              bookingId: booking.bookingId,
              oldStatus: BookingStatus.PENDING_PAYMENT,
              newStatus: BookingStatus.PAYMENT_PROCESSING,
              actionType: "USER_CREATE_PAYMENT",
              actionByUserId: userId,
              note: "Tạo thanh toán mock, chờ callback"
            });
          } else {
            await tx.booking.update({
              where: { bookingId: booking.bookingId },
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
              booking: true
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
            if (payment.booking.holdExpiresAt && payment.booking.holdExpiresAt <= now) {
              await tx.payment.update({
                where: { paymentId: payment.paymentId },
                data: {
                  paymentStatus: PaymentStatus.EXPIRED,
                  rawCallback: input,
                  paidAt: null
                }
              });
              await this.expireBookingIfStillWaiting(tx, payment.booking, now);

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
              payment.booking.bookingStatus === BookingStatus.PENDING_PAYMENT ||
              payment.booking.bookingStatus === BookingStatus.PAYMENT_PROCESSING
            ) {
              await tx.booking.update({
                where: { bookingId: payment.bookingId },
                data: {
                  bookingStatus: BookingStatus.CONFIRMED,
                  paymentStatus: PaymentStatus.SUCCESS,
                  holdExpiresAt: null
                }
              });

              await this.state.recordStatusHistory(tx, {
                bookingId: payment.bookingId,
                oldStatus: payment.booking.bookingStatus,
                newStatus: BookingStatus.CONFIRMED,
                actionType: "PAYMENT_SUCCESS_CONFIRM_BOOKING",
                note: "Thanh toán thành công, booking được xác nhận"
              });
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
          await tx.booking.update({
            where: { bookingId: payment.bookingId },
            data: {
              paymentStatus: input.status
            }
          });

          if (
            input.status === PaymentStatus.EXPIRED ||
            (payment.booking.holdExpiresAt && payment.booking.holdExpiresAt <= now)
          ) {
            await this.expireBookingIfStillWaiting(tx, payment.booking, now);
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
              booking: {
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

  private assertBookingCanCreatePayment(
    booking: {
      bookingStatus: BookingStatus;
      holdExpiresAt: Date | null;
      totalAmount: Prisma.Decimal;
    },
    amount: number,
    now: Date
  ): void {
    if (
      booking.bookingStatus !== BookingStatus.PENDING_PAYMENT &&
      booking.bookingStatus !== BookingStatus.PAYMENT_PROCESSING
    ) {
      throw new AppError(
        409,
        "Payment can only be created for pending-payment bookings",
        "BOOKING_NOT_PAYABLE"
      );
    }

    if (!booking.holdExpiresAt || booking.holdExpiresAt <= now) {
      throw new AppError(409, "Booking payment hold has expired", "BOOKING_HOLD_EXPIRED");
    }

    if (!new Prisma.Decimal(amount).equals(booking.totalAmount)) {
      throw new AppError(400, "Payment amount must equal booking total amount", "PAYMENT_AMOUNT_MISMATCH");
    }
  }

  private async expireBookingIfStillWaiting(
    tx: Prisma.TransactionClient,
    booking: {
      bookingId: string;
      bookingStatus: BookingStatus;
    },
    now: Date
  ): Promise<void> {
    if (
      booking.bookingStatus !== BookingStatus.PENDING_PAYMENT &&
      booking.bookingStatus !== BookingStatus.PAYMENT_PROCESSING
    ) {
      return;
    }

    const updated = await tx.booking.updateMany({
      where: {
        bookingId: booking.bookingId,
        bookingStatus: {
          in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAYMENT_PROCESSING]
        }
      },
      data: {
        bookingStatus: BookingStatus.PAYMENT_EXPIRED,
        paymentStatus: PaymentStatus.EXPIRED,
        refundable: false,
        noRefundReason: "Payment callback arrived after hold expired"
      }
    });

    if (updated.count === 0) {
      return;
    }

    await this.state.recordStatusHistory(tx, {
      bookingId: booking.bookingId,
      oldStatus: booking.bookingStatus,
      newStatus: BookingStatus.PAYMENT_EXPIRED,
      actionType: "PAYMENT_CALLBACK_EXPIRED_HOLD",
      note: `Payment callback processed after hold expired at ${now.toISOString()}`
    });
  }
}

export const paymentsService = new PaymentsService();
