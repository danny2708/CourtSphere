import {
  BookingPermissionStatus,
  BookingStatus,
  CourtStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
  type PrismaClient
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ReportsService } from "./reports.service";

const now = new Date("2026-05-26T12:00:00.000Z");
const fromDate = new Date("2026-05-01T00:00:00.000Z");
const toDate = new Date("2026-05-31T23:59:59.999Z");
const courtAId = "00000000-0000-4000-8000-000000003001";
const courtBId = "00000000-0000-4000-8000-000000003002";
const userAId = "00000000-0000-4000-8000-000000003003";
const userBId = "00000000-0000-4000-8000-000000003004";

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function createDb(overrides: Record<string, unknown> = {}) {
  return {
    bookingOrder: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([])
    },
    bookingItem: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([])
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([])
    },
    refund: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { refundAmount: null } }),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([])
    },
    user: {
      count: vi.fn().mockResolvedValue(0)
    },
    court: {
      count: vi.fn().mockResolvedValue(0)
    },
    waitlistEntry: {
      count: vi.fn().mockResolvedValue(0)
    },
    violation: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([])
    },
    ...overrides
  } as unknown as PrismaClient;
}

describe("ReportsService", () => {
  it("returns overview with SUCCESS payment revenue only", async () => {
    const db = createDb();
    vi.mocked(db.bookingOrder.count).mockResolvedValue(2);
    vi.mocked(db.bookingItem.count)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    vi.mocked(db.payment.aggregate).mockResolvedValue({
      _sum: { amount: decimal(150000) }
    } as never);
    vi.mocked(db.refund.aggregate).mockResolvedValue({
      _sum: { refundAmount: decimal(50000) }
    } as never);
    vi.mocked(db.user.count).mockResolvedValue(10);
    vi.mocked(db.court.count).mockResolvedValue(3);
    vi.mocked(db.waitlistEntry.count).mockResolvedValue(5);
    vi.mocked(db.violation.count).mockResolvedValue(2);
    const service = new ReportsService(db, () => now);

    const overview = await service.getOverview({ fromDate, toDate });

    expect(overview).toMatchObject({
      totalBookingOrders: 2,
      totalBookingItems: 4,
      totalRevenue: 150000,
      totalRefundAmount: 50000,
      totalCancelled: 1,
      totalNoShow: 1,
      totalUsers: 10,
      activeCourts: 3,
      waitlistCount: 5,
      violationCount: 2
    });
    expect(db.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentStatus: PaymentStatus.SUCCESS
        })
      })
    );
    expect(db.refund.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          refundStatus: RefundStatus.SUCCESS
        })
      })
    );
    expect(db.court.count).toHaveBeenCalledWith({
      where: { status: CourtStatus.ACTIVE }
    });
  });

  it("groups booking report by day", async () => {
    const db = createDb();
    vi.mocked(db.bookingOrder.findMany).mockResolvedValue([
      { createdAt: new Date("2026-05-01T01:00:00.000Z") },
      { createdAt: new Date("2026-05-01T02:00:00.000Z") },
      { createdAt: new Date("2026-05-02T01:00:00.000Z") }
    ] as never);
    vi.mocked(db.bookingItem.findMany).mockResolvedValue([
      { startDatetime: new Date("2026-05-01T08:00:00.000Z") },
      { startDatetime: new Date("2026-05-03T08:00:00.000Z") }
    ] as never);
    const service = new ReportsService(db, () => now);

    const report = await service.getBookingReport({ fromDate, toDate, groupBy: "day" });

    expect(report.buckets).toEqual([
      { period: "2026-05-01", bookingOrdersCount: 2, bookingItemsCount: 1 },
      { period: "2026-05-02", bookingOrdersCount: 1, bookingItemsCount: 0 },
      { period: "2026-05-03", bookingOrdersCount: 0, bookingItemsCount: 1 }
    ]);
  });

  it("groups booking report by month", async () => {
    const db = createDb();
    vi.mocked(db.bookingOrder.findMany).mockResolvedValue([
      { createdAt: new Date("2026-05-01T01:00:00.000Z") },
      { createdAt: new Date("2026-06-01T01:00:00.000Z") }
    ] as never);
    vi.mocked(db.bookingItem.findMany).mockResolvedValue([
      { startDatetime: new Date("2026-05-03T08:00:00.000Z") }
    ] as never);
    const service = new ReportsService(db, () => now);

    const report = await service.getBookingReport({ fromDate, toDate, groupBy: "month" });

    expect(report.buckets).toEqual([
      { period: "2026-05", bookingOrdersCount: 1, bookingItemsCount: 1 },
      { period: "2026-06", bookingOrdersCount: 1, bookingItemsCount: 0 }
    ]);
  });

  it("calculates revenue report net revenue by subtracting SUCCESS refunds", async () => {
    const db = createDb();
    vi.mocked(db.payment.findMany).mockResolvedValue([
      { paidAt: new Date("2026-05-01T03:00:00.000Z"), amount: decimal(100000) },
      { paidAt: new Date("2026-05-01T04:00:00.000Z"), amount: decimal(50000) }
    ] as never);
    vi.mocked(db.refund.findMany).mockResolvedValue([
      { processedAt: new Date("2026-05-01T05:00:00.000Z"), refundAmount: decimal(30000) }
    ] as never);
    const service = new ReportsService(db, () => now);

    const report = await service.getRevenueReport({ fromDate, toDate, groupBy: "day" });

    expect(report.buckets).toEqual([
      {
        period: "2026-05-01",
        grossRevenue: 150000,
        refundAmount: 30000,
        netRevenue: 120000,
        successPaymentCount: 2,
        successRefundCount: 1
      }
    ]);
    expect(report.totals).toEqual({
      grossRevenue: 150000,
      refundAmount: 30000,
      netRevenue: 120000,
      successPaymentCount: 2,
      successRefundCount: 1
    });
  });

  it("sorts court usage by booking item count and booked minutes", async () => {
    const db = createDb();
    vi.mocked(db.bookingItem.findMany).mockResolvedValue([
      {
        courtId: courtAId,
        startDatetime: new Date("2026-05-01T08:00:00.000Z"),
        endDatetime: new Date("2026-05-01T09:00:00.000Z"),
        bookingStatus: BookingStatus.COMPLETED,
        court: { courtId: courtAId, courtName: "Court A" }
      },
      {
        courtId: courtAId,
        startDatetime: new Date("2026-05-02T08:00:00.000Z"),
        endDatetime: new Date("2026-05-02T09:30:00.000Z"),
        bookingStatus: BookingStatus.NO_SHOW,
        court: { courtId: courtAId, courtName: "Court A" }
      },
      {
        courtId: courtBId,
        startDatetime: new Date("2026-05-01T08:00:00.000Z"),
        endDatetime: new Date("2026-05-01T09:00:00.000Z"),
        bookingStatus: BookingStatus.CANCELLED_BY_USER,
        court: { courtId: courtBId, courtName: "Court B" }
      }
    ] as never);
    const service = new ReportsService(db, () => now);

    const report = await service.getCourtUsageReport({ fromDate, toDate });

    expect(report.courts).toEqual([
      {
        courtId: courtAId,
        courtName: "Court A",
        bookingItemCount: 2,
        totalBookedMinutes: 150,
        completedCount: 1,
        noShowCount: 1,
        cancelledCount: 0
      },
      {
        courtId: courtBId,
        courtName: "Court B",
        bookingItemCount: 1,
        totalBookedMinutes: 0,
        completedCount: 0,
        noShowCount: 0,
        cancelledCount: 1
      }
    ]);
  });

  it("calculates cancellation, refund, no-show, payment-expired, and waitlist-expired rates", async () => {
    const db = createDb();
    vi.mocked(db.bookingItem.count)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    vi.mocked(db.bookingOrder.count)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1);
    vi.mocked(db.payment.count).mockResolvedValue(4);
    vi.mocked(db.refund.count).mockResolvedValue(1);
    vi.mocked(db.waitlistEntry.count)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2);
    const service = new ReportsService(db, () => now);

    const report = await service.getRatesReport({ fromDate, toDate });

    expect(report).toMatchObject({
      cancellationRate: 20,
      refundRate: 25,
      noShowRate: 10,
      paymentExpiredRate: 20,
      waitlistExpiredRate: 25,
      counts: {
        totalBookingItems: 10,
        cancelledBookingItems: 2,
        noShowBookingItems: 1,
        totalBookingOrders: 5,
        paymentExpiredOrders: 1,
        successPayments: 4,
        successRefunds: 1,
        totalWaitlistEntries: 8,
        expiredWaitlistEntries: 2
      }
    });
  });

  it("sorts violating users by penalty points and count", async () => {
    const db = createDb();
    vi.mocked(db.violation.findMany).mockResolvedValue([
      {
        userId: userAId,
        penaltyPoints: 1,
        user: {
          userId: userAId,
          fullName: "Alice",
          email: "alice@example.edu",
          violationPoints: 3,
          bookingPermissionStatus: BookingPermissionStatus.RESTRICTED
        }
      },
      {
        userId: userBId,
        penaltyPoints: 2,
        user: {
          userId: userBId,
          fullName: "Bob",
          email: "bob@example.edu",
          violationPoints: 2,
          bookingPermissionStatus: BookingPermissionStatus.ALLOWED
        }
      },
      {
        userId: userAId,
        penaltyPoints: 3,
        user: {
          userId: userAId,
          fullName: "Alice",
          email: "alice@example.edu",
          violationPoints: 3,
          bookingPermissionStatus: BookingPermissionStatus.RESTRICTED
        }
      }
    ] as never);
    const service = new ReportsService(db, () => now);

    const report = await service.getViolatingUsersReport({ fromDate, toDate, limit: 10 });

    expect(report.users).toEqual([
      {
        userId: userAId,
        fullName: "Alice",
        email: "alice@example.edu",
        violationCount: 2,
        totalPenaltyPoints: 4,
        currentViolationPoints: 3,
        bookingPermissionStatus: BookingPermissionStatus.RESTRICTED
      },
      {
        userId: userBId,
        fullName: "Bob",
        email: "bob@example.edu",
        violationCount: 1,
        totalPenaltyPoints: 2,
        currentViolationPoints: 2,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED
      }
    ]);
    expect(db.violation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isWaived: false
        })
      })
    );
  });
});
