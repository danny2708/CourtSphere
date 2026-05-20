import { BookingStatus, PaymentStatus, Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { BookingStateService } from "../bookings/booking-state.service";
import type { MockPaymentGateway } from "./payment-gateway.mock";
import { PaymentsService } from "./payments.service";

const userId = "00000000-0000-4000-8000-000000000901";
const otherUserId = "00000000-0000-4000-8000-000000000902";
const bookingId = "00000000-0000-4000-8000-000000000904";
const paymentId = "00000000-0000-4000-8000-000000000905";
const courtId = "00000000-0000-4000-8000-000000000906";
const courtTypeId = "00000000-0000-4000-8000-000000000907";
const gatewayTransactionId = "mock_tx_1";
const now = new Date("2026-05-20T00:00:00.000Z");

function buildBooking(overrides: Record<string, unknown> = {}) {
  return {
    bookingId,
    bookingCode: "BK-20260520-TEST01",
    userId,
    courtId,
    startDatetime: new Date("2026-05-21T08:00:00.000Z"),
    endDatetime: new Date("2026-05-21T09:00:00.000Z"),
    participantCount: 10,
    usagePurpose: "Class training",
    totalAmount: new Prisma.Decimal(50000),
    bookingStatus: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.INITIATED,
    refundable: true,
    holdExpiresAt: new Date("2026-05-20T00:10:00.000Z"),
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    checkedInByUserId: null,
    completedByUserId: null,
    noShowMarkedByUserId: null,
    managerNote: null,
    noRefundReason: null,
    checkinTime: null,
    checkoutTime: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function buildPayment(overrides: Record<string, unknown> = {}) {
  return {
    paymentId,
    bookingId,
    userId,
    amount: new Prisma.Decimal(50000),
    paymentMethod: "MOCK",
    gatewayTransactionId,
    paymentStatus: PaymentStatus.PROCESSING,
    rawCallback: null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    user: {
      userId,
      fullName: "Sample User",
      email: "user@example.edu"
    },
    booking: {
      ...buildBooking(),
      user: {
        userId,
        fullName: "Sample User",
        email: "user@example.edu"
      },
      court: {
        courtId,
        courtTypeId,
        courtName: "Main Field",
        location: "North Campus",
        capacity: 20,
        description: null,
        imageUrl: null,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        courtType: {
          courtTypeId,
          typeName: "Football",
          description: null,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now
        }
      }
    },
    ...overrides
  };
}

function createGateway(overrides: Partial<MockPaymentGateway> = {}) {
  return {
    createTransaction: vi.fn().mockReturnValue({
      gatewayTransactionId,
      paymentUrl: `/mock-payment/${gatewayTransactionId}`
    }),
    sign: vi.fn(),
    verify: vi.fn().mockReturnValue(true),
    ...overrides
  } as unknown as MockPaymentGateway;
}

function createService(input: {
  tx?: unknown;
  payment?: unknown;
  gateway?: MockPaymentGateway;
}) {
  const db = {
    $transaction: vi.fn((callback) => callback(input.tx)),
    payment: {
      findUnique: vi.fn().mockResolvedValue(input.payment ?? buildPayment()),
      findMany: vi.fn().mockResolvedValue([input.payment ?? buildPayment()])
    }
  } as unknown as PrismaClient;

  return {
    service: new PaymentsService(
      db,
      input.gateway ?? createGateway(),
      new BookingStateService(),
      () => now
    ),
    db: db as unknown as {
      $transaction: ReturnType<typeof vi.fn>;
      payment: {
        findUnique: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    }
  };
}

describe("PaymentsService", () => {
  it("allows owner to create payment for a pending-payment booking", async () => {
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(buildBooking({ payments: [] })),
        update: vi.fn().mockResolvedValue({})
      },
      payment: {
        create: vi.fn().mockResolvedValue({ paymentId })
      },
      bookingStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const { service } = createService({ tx });

    const payment = await service.createPaymentForBooking(userId, bookingId, {
      amount: 50000
    });

    expect(payment).toMatchObject({
      id: paymentId,
      paymentStatus: PaymentStatus.PROCESSING,
      paymentUrl: `/mock-payment/${gatewayTransactionId}`
    });
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId,
          userId,
          amount: new Prisma.Decimal(50000),
          paymentMethod: "MOCK",
          gatewayTransactionId,
          paymentStatus: PaymentStatus.PROCESSING
        })
      })
    );
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.PAYMENT_PROCESSING,
          paymentStatus: PaymentStatus.PROCESSING
        })
      })
    );
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.PENDING_PAYMENT,
          newStatus: BookingStatus.PAYMENT_PROCESSING,
          actionType: "USER_CREATE_PAYMENT"
        })
      })
    );
  });

  it("does not allow another user to create payment for an owned booking", async () => {
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    };
    const { service } = createService({ tx });

    await expect(
      service.createPaymentForBooking(otherUserId, bookingId, { amount: 50000 })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "BOOKING_NOT_FOUND"
    });
  });

  it("does not create payment for confirmed bookings", async () => {
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(
          buildBooking({
            bookingStatus: BookingStatus.CONFIRMED,
            paymentStatus: PaymentStatus.SUCCESS,
            payments: []
          })
        )
      }
    };
    const { service } = createService({ tx });

    await expect(
      service.createPaymentForBooking(userId, bookingId, { amount: 50000 })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BOOKING_NOT_PAYABLE"
    });
  });

  it("does not create payment after the hold expires", async () => {
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(
          buildBooking({
            holdExpiresAt: new Date("2026-05-19T23:59:00.000Z"),
            payments: []
          })
        )
      }
    };
    const { service } = createService({ tx });

    await expect(
      service.createPaymentForBooking(userId, bookingId, { amount: 50000 })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BOOKING_HOLD_EXPIRED"
    });
  });

  it("does not create payment when amount differs from booking total", async () => {
    const tx = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(buildBooking({ payments: [] }))
      }
    };
    const { service } = createService({ tx });

    await expect(
      service.createPaymentForBooking(userId, bookingId, { amount: 1000 })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "PAYMENT_AMOUNT_MISMATCH"
    });
  });

  it("confirms booking and writes history on successful callback", async () => {
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(
          buildPayment({
            booking: buildBooking({ bookingStatus: BookingStatus.PAYMENT_PROCESSING })
          })
        ),
        update: vi.fn().mockResolvedValue({})
      },
      booking: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn()
      },
      bookingStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    const { service } = createService({
      tx,
      payment: buildPayment({
        paymentStatus: PaymentStatus.SUCCESS,
        paidAt: now,
        booking: buildPayment().booking
      })
    });

    const payment = await service.handleMockCallback({
      gatewayTransactionId,
      status: PaymentStatus.SUCCESS,
      signature: "valid"
    });

    expect(payment.paymentStatus).toBe(PaymentStatus.SUCCESS);
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.SUCCESS,
          rawCallback: expect.objectContaining({ status: PaymentStatus.SUCCESS }),
          paidAt: now
        })
      })
    );
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.SUCCESS,
          holdExpiresAt: null
        })
      })
    );
    expect(tx.bookingStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.PAYMENT_PROCESSING,
          newStatus: BookingStatus.CONFIRMED,
          actionType: "PAYMENT_SUCCESS_CONFIRM_BOOKING",
          note: "Thanh toán thành công, booking được xác nhận"
        })
      })
    );
  });

  it("keeps successful callback idempotent without duplicate history", async () => {
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(
          buildPayment({
            paymentStatus: PaymentStatus.SUCCESS,
            paidAt: now,
            booking: buildBooking({ bookingStatus: BookingStatus.CONFIRMED })
          })
        ),
        update: vi.fn()
      },
      booking: {
        update: vi.fn()
      },
      bookingStatusHistory: {
        create: vi.fn()
      }
    };
    const { service } = createService({
      tx,
      payment: buildPayment({
        paymentStatus: PaymentStatus.SUCCESS,
        paidAt: now
      })
    });

    const payment = await service.handleMockCallback({
      gatewayTransactionId,
      status: PaymentStatus.SUCCESS,
      signature: "valid"
    });

    expect(payment.paymentStatus).toBe(PaymentStatus.SUCCESS);
    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(tx.bookingStatusHistory.create).not.toHaveBeenCalled();
  });

  it("rejects callback with invalid signature", async () => {
    const gateway = createGateway({
      verify: vi.fn().mockReturnValue(false)
    });
    const tx = {};
    const { service, db } = createService({ tx, gateway });

    await expect(
      service.handleMockCallback({
        gatewayTransactionId,
        status: PaymentStatus.SUCCESS,
        signature: "invalid"
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_PAYMENT_SIGNATURE"
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("updates failed callback without confirming booking", async () => {
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(
          buildPayment({
            booking: buildBooking({ bookingStatus: BookingStatus.PAYMENT_PROCESSING })
          })
        ),
        update: vi.fn().mockResolvedValue({})
      },
      booking: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn()
      },
      bookingStatusHistory: {
        create: vi.fn()
      }
    };
    const { service } = createService({
      tx,
      payment: buildPayment({
        paymentStatus: PaymentStatus.FAILED
      })
    });

    const payment = await service.handleMockCallback({
      gatewayTransactionId,
      status: PaymentStatus.FAILED,
      signature: "valid"
    });

    expect(payment.paymentStatus).toBe(PaymentStatus.FAILED);
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.FAILED
        })
      })
    );
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          paymentStatus: PaymentStatus.FAILED
        }
      })
    );
    expect(tx.bookingStatusHistory.create).not.toHaveBeenCalled();
  });

  it("allows owner to get payment detail", async () => {
    const { service } = createService({});

    const payment = await service.getPaymentDetail({ userId, roles: ["USER"] }, paymentId);

    expect(payment).toMatchObject({
      id: paymentId,
      user: {
        id: userId
      }
    });
  });

  it("forbids another user from getting payment detail", async () => {
    const { service } = createService({});

    await expect(
      service.getPaymentDetail({ userId: otherUserId, roles: ["USER"] }, paymentId)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "PAYMENT_FORBIDDEN"
    });
  });

  it("lists payments for admin with filters", async () => {
    const { service, db } = createService({});

    const payments = await service.listPaymentsForAdmin({
      status: PaymentStatus.PROCESSING,
      bookingCode: "BK",
      userId,
      fromDate: new Date("2026-05-20T00:00:00.000Z"),
      toDate: new Date("2026-05-21T00:00:00.000Z")
    });

    expect(payments).toHaveLength(1);
    expect(db.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentStatus: PaymentStatus.PROCESSING,
          userId,
          booking: {
            bookingCode: {
              contains: "BK",
              mode: "insensitive"
            }
          }
        })
      })
    );
  });
});
