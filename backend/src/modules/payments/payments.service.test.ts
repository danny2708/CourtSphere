import {
  BookingStatus,
  CourtStatus,
  EntityStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  type PrismaClient
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { BookingStateService } from "../bookings/booking-state.service";
import type { MockPaymentGateway } from "./payment-gateway.mock";
import { PaymentsService } from "./payments.service";

const userId = "00000000-0000-4000-8000-000000000901";
const otherUserId = "00000000-0000-4000-8000-000000000902";
const bookingOrderId = "00000000-0000-4000-8000-000000000904";
const bookingItemId = "00000000-0000-4000-8000-000000000914";
const paymentId = "00000000-0000-4000-8000-000000000905";
const courtId = "00000000-0000-4000-8000-000000000906";
const courtTypeId = "00000000-0000-4000-8000-000000000907";
const gatewayTransactionId = "mock_tx_1";
const now = new Date("2026-05-20T00:00:00.000Z");

function buildItem(overrides: Record<string, unknown> = {}) {
  return {
    bookingItemId,
    bookingOrderId,
    courtId,
    startDatetime: new Date("2026-05-21T08:00:00.000Z"),
    endDatetime: new Date("2026-05-21T09:00:00.000Z"),
    unitPrice: new Prisma.Decimal(50000),
    amount: new Prisma.Decimal(50000),
    bookingStatus: BookingStatus.PENDING_PAYMENT,
    checkinTime: null,
    checkedInByUserId: null,
    completedByUserId: null,
    noShowMarkedByUserId: null,
    managerNote: null,
    createdAt: now,
    updatedAt: now,
    court: {
      courtId,
      courtTypeId,
      courtName: "Main Field",
      description: null,
      imageUrl: null,
      status: CourtStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      courtType: {
        courtTypeId,
        typeName: "Football",
        description: null,
        status: EntityStatus.ACTIVE,
        createdAt: now,
        updatedAt: now
      }
    },
    ...overrides
  };
}

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    bookingOrderId,
    bookingCode: "BK-20260520-TEST01",
    userId,
    totalAmount: new Prisma.Decimal(50000),
    bookingStatus: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.INITIATED,
    refundable: true,
    holdExpiresAt: new Date("2026-05-20T00:10:00.000Z"),
    note: null,
    cancelReason: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    user: {
      userId,
      fullName: "Sample User",
      email: "user@example.edu"
    },
    items: [buildItem()],
    ...overrides
  };
}

function buildPayment(overrides: Record<string, unknown> = {}) {
  return {
    paymentId,
    bookingOrderId,
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
    bookingOrder: buildOrder(),
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
  it("allows owner to create payment for a pending-payment booking order", async () => {
    const tx = {
      bookingOrder: {
        findFirst: vi.fn().mockResolvedValue(buildOrder({ payments: [] })),
        update: vi.fn().mockResolvedValue({})
      },
      bookingItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      payment: {
        create: vi.fn().mockResolvedValue({ paymentId })
      },
      bookingOrderStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      bookingItemStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({})
      }
    };
    const { service } = createService({ tx });

    const payment = await service.createPaymentForBooking(userId, bookingOrderId, {
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
          bookingOrderId,
          userId,
          amount: new Prisma.Decimal(50000),
          paymentMethod: "MOCK",
          gatewayTransactionId,
          paymentStatus: PaymentStatus.PROCESSING
        })
      })
    );
    expect(tx.bookingOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.PAYMENT_PROCESSING,
          paymentStatus: PaymentStatus.PROCESSING
        })
      })
    );
    expect(tx.bookingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bookingStatus: BookingStatus.PAYMENT_PROCESSING
        }
      })
    );
    expect(tx.bookingOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: BookingStatus.PENDING_PAYMENT,
          newStatus: BookingStatus.PAYMENT_PROCESSING,
          actionType: "USER_CREATE_PAYMENT"
        })
      })
    );
  });

  it("does not allow another user to create payment for an owned booking order", async () => {
    const tx = {
      bookingOrder: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    };
    const { service } = createService({ tx });

    await expect(
      service.createPaymentForBooking(otherUserId, bookingOrderId, { amount: 50000 })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "BOOKING_NOT_FOUND"
    });
  });

  it("does not create payment for confirmed booking orders", async () => {
    const tx = {
      bookingOrder: {
        findFirst: vi.fn().mockResolvedValue(
          buildOrder({
            bookingStatus: BookingStatus.CONFIRMED,
            paymentStatus: PaymentStatus.SUCCESS,
            payments: []
          })
        )
      }
    };
    const { service } = createService({ tx });

    await expect(
      service.createPaymentForBooking(userId, bookingOrderId, { amount: 50000 })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BOOKING_NOT_PAYABLE"
    });
  });

  it("does not create payment after the hold expires", async () => {
    const tx = {
      bookingOrder: {
        findFirst: vi.fn().mockResolvedValue(
          buildOrder({
            holdExpiresAt: new Date("2026-05-19T23:59:00.000Z"),
            payments: []
          })
        )
      }
    };
    const { service } = createService({ tx });

    await expect(
      service.createPaymentForBooking(userId, bookingOrderId, { amount: 50000 })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "BOOKING_HOLD_EXPIRED"
    });
  });

  it("confirms booking order and all pending items on successful callback", async () => {
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(
          buildPayment({
            bookingOrder: buildOrder({
              bookingStatus: BookingStatus.PAYMENT_PROCESSING,
              items: [
                buildItem({
                  bookingStatus: BookingStatus.PAYMENT_PROCESSING
                })
              ]
            })
          })
        ),
        update: vi.fn().mockResolvedValue({})
      },
      bookingOrder: {
        update: vi.fn().mockResolvedValue({})
      },
      bookingItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      bookingOrderStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      bookingItemStatusHistory: {
        create: vi.fn().mockResolvedValue({})
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({})
      }
    };
    const { service } = createService({
      tx,
      payment: buildPayment({
        paymentStatus: PaymentStatus.SUCCESS,
        paidAt: now,
        bookingOrder: buildOrder({
          bookingStatus: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.SUCCESS,
          holdExpiresAt: null,
          items: [
            buildItem({
              bookingStatus: BookingStatus.CONFIRMED
            })
          ]
        })
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
    expect(tx.bookingOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingStatus: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.SUCCESS,
          holdExpiresAt: null
        })
      })
    );
    expect(tx.bookingItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          bookingStatus: BookingStatus.CONFIRMED
        }
      })
    );
    expect(tx.bookingItemStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          newStatus: BookingStatus.CONFIRMED,
          actionType: "PAYMENT_SUCCESS_CONFIRM_BOOKING_ITEM"
        })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingOrderId,
          notificationType: NotificationType.PAYMENT_SUCCESS
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
            bookingOrder: buildOrder({ bookingStatus: BookingStatus.CONFIRMED })
          })
        ),
        update: vi.fn()
      },
      bookingOrder: {
        update: vi.fn()
      },
      bookingItem: {
        updateMany: vi.fn()
      },
      bookingOrderStatusHistory: {
        create: vi.fn()
      },
      bookingItemStatusHistory: {
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
    expect(tx.bookingOrder.update).not.toHaveBeenCalled();
    expect(tx.bookingOrderStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.bookingItemStatusHistory.create).not.toHaveBeenCalled();
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

  it("updates failed callback without confirming booking order", async () => {
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(
          buildPayment({
            bookingOrder: buildOrder({ bookingStatus: BookingStatus.PAYMENT_PROCESSING })
          })
        ),
        update: vi.fn().mockResolvedValue({})
      },
      bookingOrder: {
        update: vi.fn().mockResolvedValue({})
      },
      bookingItem: {
        updateMany: vi.fn()
      },
      bookingOrderStatusHistory: {
        create: vi.fn()
      },
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({})
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
    expect(tx.bookingOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          paymentStatus: PaymentStatus.FAILED
        }
      })
    );
    expect(tx.bookingItem.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingOrderStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          bookingOrderId,
          notificationType: NotificationType.SYSTEM
        })
      })
    );
  });

  it("allows owner to get payment detail", async () => {
    const { service } = createService({});

    const payment = await service.getPaymentDetail({ userId, roles: ["USER"] }, paymentId);

    expect(payment).toMatchObject({
      id: paymentId,
      user: {
        id: userId
      },
      bookingOrder: {
        id: bookingOrderId
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
          bookingOrder: {
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
