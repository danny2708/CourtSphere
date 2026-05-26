import {
  BookingStatus,
  CourtStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RefundStatus,
  WaitlistStatus
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import type {
  GroupedReportsQuery,
  NormalizedDateRange,
  ReportGroupBy,
  ReportsDateRangeQuery,
  ViolatingUsersReportQuery
} from "./reports.types";

const DEFAULT_RANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60_000;
const cancelledBookingStatuses: BookingStatus[] = [
  BookingStatus.CANCELLED_BY_USER,
  BookingStatus.CANCELLED_BY_MANAGER,
  BookingStatus.CANCELLED_BY_ADMIN
];
const bookedUsageStatuses: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.IN_USE,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW
];

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 10_000) / 100;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
}

function dateRangeWhere(range: NormalizedDateRange) {
  return {
    gte: range.fromDate,
    lte: range.toDate
  };
}

function periodKey(date: Date, groupBy: ReportGroupBy): string {
  if (groupBy === "month") {
    return date.toISOString().slice(0, 7);
  }

  return date.toISOString().slice(0, 10);
}

function normalizeDateRange(
  query: ReportsDateRangeQuery,
  now: Date
): NormalizedDateRange {
  const toDate = query.toDate ?? now;
  const fromDate = query.fromDate ?? new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

  return { fromDate, toDate };
}

type BookingPeriodBucket = {
  period: string;
  bookingOrdersCount: number;
  bookingItemsCount: number;
};

type RevenuePeriodBucket = {
  period: string;
  grossRevenue: number;
  refundAmount: number;
  netRevenue: number;
  successPaymentCount: number;
  successRefundCount: number;
};

type CourtUsageBucket = {
  courtId: string;
  courtName: string;
  bookingItemCount: number;
  totalBookedMinutes: number;
  completedCount: number;
  noShowCount: number;
  cancelledCount: number;
};

type ViolatingUserBucket = {
  userId: string;
  fullName: string;
  email: string;
  violationCount: number;
  totalPenaltyPoints: number;
  currentViolationPoints: number;
  bookingPermissionStatus: string;
};

export class ReportsService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async getOverview(query: ReportsDateRangeQuery) {
    const range = normalizeDateRange(query, this.nowProvider());
    const [
      totalBookingOrders,
      totalBookingItems,
      revenueAggregate,
      refundAggregate,
      totalCancelled,
      totalNoShow,
      totalUsers,
      activeCourts,
      waitlistCount,
      violationCount
    ] = await Promise.all([
      this.db.bookingOrder.count({
        where: { createdAt: dateRangeWhere(range) }
      }),
      this.db.bookingItem.count({
        where: { startDatetime: dateRangeWhere(range) }
      }),
      this.db.payment.aggregate({
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          paidAt: {
            not: null,
            ...dateRangeWhere(range)
          }
        },
        _sum: { amount: true }
      }),
      this.db.refund.aggregate({
        where: {
          refundStatus: RefundStatus.SUCCESS,
          processedAt: {
            not: null,
            ...dateRangeWhere(range)
          }
        },
        _sum: { refundAmount: true }
      }),
      this.db.bookingItem.count({
        where: {
          startDatetime: dateRangeWhere(range),
          bookingStatus: { in: cancelledBookingStatuses }
        }
      }),
      this.db.bookingItem.count({
        where: {
          startDatetime: dateRangeWhere(range),
          bookingStatus: BookingStatus.NO_SHOW
        }
      }),
      this.db.user.count({
        where: {
          createdAt: { lte: range.toDate }
        }
      }),
      this.db.court.count({
        where: { status: CourtStatus.ACTIVE }
      }),
      this.db.waitlistEntry.count({
        where: { registeredAt: dateRangeWhere(range) }
      }),
      this.db.violation.count({
        where: { recordedAt: dateRangeWhere(range) }
      })
    ]);

    return {
      dateRange: range,
      totalBookingOrders,
      totalBookingItems,
      totalRevenue: roundMoney(decimalToNumber(revenueAggregate._sum.amount)),
      totalRefundAmount: roundMoney(decimalToNumber(refundAggregate._sum.refundAmount)),
      totalCancelled,
      totalNoShow,
      totalUsers,
      activeCourts,
      waitlistCount,
      violationCount
    };
  }

  async getBookingReport(query: GroupedReportsQuery) {
    const range = normalizeDateRange(query, this.nowProvider());
    const [orders, items] = await Promise.all([
      this.db.bookingOrder.findMany({
        where: { createdAt: dateRangeWhere(range) },
        select: { createdAt: true }
      }),
      this.db.bookingItem.findMany({
        where: { startDatetime: dateRangeWhere(range) },
        select: { startDatetime: true }
      })
    ]);
    const buckets = new Map<string, BookingPeriodBucket>();
    const getBucket = (period: string): BookingPeriodBucket => {
      const existing = buckets.get(period);

      if (existing) {
        return existing;
      }

      const created = {
        period,
        bookingOrdersCount: 0,
        bookingItemsCount: 0
      };
      buckets.set(period, created);
      return created;
    };

    for (const order of orders) {
      getBucket(periodKey(order.createdAt, query.groupBy)).bookingOrdersCount += 1;
    }

    for (const item of items) {
      getBucket(periodKey(item.startDatetime, query.groupBy)).bookingItemsCount += 1;
    }

    return {
      dateRange: range,
      groupBy: query.groupBy,
      buckets: [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period))
    };
  }

  async getRevenueReport(query: GroupedReportsQuery) {
    const range = normalizeDateRange(query, this.nowProvider());
    const [payments, refunds] = await Promise.all([
      this.db.payment.findMany({
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          paidAt: {
            not: null,
            ...dateRangeWhere(range)
          }
        },
        select: {
          paidAt: true,
          amount: true
        }
      }),
      this.db.refund.findMany({
        where: {
          refundStatus: RefundStatus.SUCCESS,
          processedAt: {
            not: null,
            ...dateRangeWhere(range)
          }
        },
        select: {
          processedAt: true,
          refundAmount: true
        }
      })
    ]);
    const buckets = new Map<string, RevenuePeriodBucket>();
    const getBucket = (period: string): RevenuePeriodBucket => {
      const existing = buckets.get(period);

      if (existing) {
        return existing;
      }

      const created = {
        period,
        grossRevenue: 0,
        refundAmount: 0,
        netRevenue: 0,
        successPaymentCount: 0,
        successRefundCount: 0
      };
      buckets.set(period, created);
      return created;
    };

    for (const payment of payments) {
      if (!payment.paidAt) {
        continue;
      }

      const bucket = getBucket(periodKey(payment.paidAt, query.groupBy));
      bucket.grossRevenue += decimalToNumber(payment.amount);
      bucket.successPaymentCount += 1;
    }

    for (const refund of refunds) {
      if (!refund.processedAt) {
        continue;
      }

      const bucket = getBucket(periodKey(refund.processedAt, query.groupBy));
      bucket.refundAmount += decimalToNumber(refund.refundAmount);
      bucket.successRefundCount += 1;
    }

    const normalizedBuckets = [...buckets.values()]
      .map((bucket) => ({
        ...bucket,
        grossRevenue: roundMoney(bucket.grossRevenue),
        refundAmount: roundMoney(bucket.refundAmount),
        netRevenue: roundMoney(bucket.grossRevenue - bucket.refundAmount)
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      dateRange: range,
      groupBy: query.groupBy,
      buckets: normalizedBuckets,
      totals: normalizedBuckets.reduce(
        (acc, bucket) => ({
          grossRevenue: roundMoney(acc.grossRevenue + bucket.grossRevenue),
          refundAmount: roundMoney(acc.refundAmount + bucket.refundAmount),
          netRevenue: roundMoney(acc.netRevenue + bucket.netRevenue),
          successPaymentCount: acc.successPaymentCount + bucket.successPaymentCount,
          successRefundCount: acc.successRefundCount + bucket.successRefundCount
        }),
        {
          grossRevenue: 0,
          refundAmount: 0,
          netRevenue: 0,
          successPaymentCount: 0,
          successRefundCount: 0
        }
      )
    };
  }

  async getCourtUsageReport(query: ReportsDateRangeQuery) {
    const range = normalizeDateRange(query, this.nowProvider());
    const items = await this.db.bookingItem.findMany({
      where: { startDatetime: dateRangeWhere(range) },
      select: {
        courtId: true,
        startDatetime: true,
        endDatetime: true,
        bookingStatus: true,
        court: {
          select: {
            courtId: true,
            courtName: true
          }
        }
      }
    });
    const buckets = new Map<string, CourtUsageBucket>();
    const getBucket = (courtId: string, courtName: string): CourtUsageBucket => {
      const existing = buckets.get(courtId);

      if (existing) {
        return existing;
      }

      const created = {
        courtId,
        courtName,
        bookingItemCount: 0,
        totalBookedMinutes: 0,
        completedCount: 0,
        noShowCount: 0,
        cancelledCount: 0
      };
      buckets.set(courtId, created);
      return created;
    };

    for (const item of items) {
      const bucket = getBucket(item.courtId, item.court.courtName);
      bucket.bookingItemCount += 1;

      if (bookedUsageStatuses.includes(item.bookingStatus)) {
        bucket.totalBookedMinutes += minutesBetween(item.startDatetime, item.endDatetime);
      }

      if (item.bookingStatus === BookingStatus.COMPLETED) {
        bucket.completedCount += 1;
      } else if (item.bookingStatus === BookingStatus.NO_SHOW) {
        bucket.noShowCount += 1;
      } else if (cancelledBookingStatuses.includes(item.bookingStatus)) {
        bucket.cancelledCount += 1;
      }
    }

    return {
      dateRange: range,
      courts: [...buckets.values()].sort(
        (a, b) =>
          b.bookingItemCount - a.bookingItemCount ||
          b.totalBookedMinutes - a.totalBookedMinutes ||
          a.courtName.localeCompare(b.courtName)
      )
    };
  }

  async getRatesReport(query: ReportsDateRangeQuery) {
    const range = normalizeDateRange(query, this.nowProvider());
    const [
      totalBookingItems,
      cancelledBookingItems,
      noShowBookingItems,
      totalBookingOrders,
      paymentExpiredOrders,
      successPayments,
      successRefunds,
      totalWaitlistEntries,
      expiredWaitlistEntries
    ] = await Promise.all([
      this.db.bookingItem.count({
        where: { startDatetime: dateRangeWhere(range) }
      }),
      this.db.bookingItem.count({
        where: {
          startDatetime: dateRangeWhere(range),
          bookingStatus: { in: cancelledBookingStatuses }
        }
      }),
      this.db.bookingItem.count({
        where: {
          startDatetime: dateRangeWhere(range),
          bookingStatus: BookingStatus.NO_SHOW
        }
      }),
      this.db.bookingOrder.count({
        where: { createdAt: dateRangeWhere(range) }
      }),
      this.db.bookingOrder.count({
        where: {
          createdAt: dateRangeWhere(range),
          bookingStatus: BookingStatus.PAYMENT_EXPIRED
        }
      }),
      this.db.payment.count({
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          paidAt: {
            not: null,
            ...dateRangeWhere(range)
          }
        }
      }),
      this.db.refund.count({
        where: {
          refundStatus: RefundStatus.SUCCESS,
          processedAt: {
            not: null,
            ...dateRangeWhere(range)
          }
        }
      }),
      this.db.waitlistEntry.count({
        where: { registeredAt: dateRangeWhere(range) }
      }),
      this.db.waitlistEntry.count({
        where: {
          registeredAt: dateRangeWhere(range),
          status: WaitlistStatus.EXPIRED
        }
      })
    ]);

    return {
      dateRange: range,
      cancellationRate: percentage(cancelledBookingItems, totalBookingItems),
      refundRate: percentage(successRefunds, successPayments),
      noShowRate: percentage(noShowBookingItems, totalBookingItems),
      paymentExpiredRate: percentage(paymentExpiredOrders, totalBookingOrders),
      waitlistExpiredRate: percentage(expiredWaitlistEntries, totalWaitlistEntries),
      counts: {
        totalBookingItems,
        cancelledBookingItems,
        noShowBookingItems,
        totalBookingOrders,
        paymentExpiredOrders,
        successPayments,
        successRefunds,
        totalWaitlistEntries,
        expiredWaitlistEntries
      }
    };
  }

  async getViolatingUsersReport(query: ViolatingUsersReportQuery) {
    const range = normalizeDateRange(query, this.nowProvider());
    const violations = await this.db.violation.findMany({
      where: {
        recordedAt: dateRangeWhere(range),
        isWaived: false
      },
      select: {
        userId: true,
        penaltyPoints: true,
        user: {
          select: {
            userId: true,
            fullName: true,
            email: true,
            violationPoints: true,
            bookingPermissionStatus: true
          }
        }
      }
    });
    const buckets = new Map<string, ViolatingUserBucket>();

    for (const violation of violations) {
      const existing = buckets.get(violation.userId);

      if (existing) {
        existing.violationCount += 1;
        existing.totalPenaltyPoints += violation.penaltyPoints;
        continue;
      }

      buckets.set(violation.userId, {
        userId: violation.user.userId,
        fullName: violation.user.fullName,
        email: violation.user.email,
        violationCount: 1,
        totalPenaltyPoints: violation.penaltyPoints,
        currentViolationPoints: violation.user.violationPoints,
        bookingPermissionStatus: violation.user.bookingPermissionStatus
      });
    }

    return {
      dateRange: range,
      users: [...buckets.values()]
        .sort(
          (a, b) =>
            b.totalPenaltyPoints - a.totalPenaltyPoints ||
            b.violationCount - a.violationCount ||
            a.fullName.localeCompare(b.fullName)
        )
        .slice(0, query.limit)
    };
  }
}

export const reportsService = new ReportsService();
