import { EntityStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../config/prisma";
import type { EffectiveBookingPolicy } from "./rules.types";

export const FALLBACK_BOOKING_RULES = {
  ruleName: "DEFAULT",
  holdMinutes: 10,
  cancelBeforeHours: 2,
  lateCheckinMinutes: 15,
  maxBookingsPerDay: 2,
  maxDurationMinutes: 120,
  violationThreshold: 3,
  bookingBanDays: 7,
  refundRateUserOnTime: 100,
  refundRateManagerFault: 100
} as const;

const bookingRuleSelect = {
  bookingRuleId: true,
  ruleName: true,
  holdMinutes: true,
  cancelBeforeHours: true,
  lateCheckinMinutes: true,
  maxBookingsPerDay: true,
  maxDurationMinutes: true,
  violationThreshold: true,
  bookingBanDays: true,
  refundRateUserOnTime: true,
  refundRateManagerFault: true,
  status: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.BookingRuleSelect;

const priorityPolicyInclude = {
  priorityGroup: true
} satisfies Prisma.PriorityPolicyInclude;

export type BookingRuleRecord = Prisma.BookingRuleGetPayload<{
  select: typeof bookingRuleSelect;
}>;
export type PriorityPolicyRecord = Prisma.PriorityPolicyGetPayload<{
  include: typeof priorityPolicyInclude;
}>;

export class RulesRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async getActiveBookingRule(): Promise<BookingRuleRecord | null> {
    return this.db.bookingRule.findFirst({
      where: { status: EntityStatus.ACTIVE },
      select: bookingRuleSelect,
      orderBy: [{ updatedAt: "desc" }]
    });
  }

  async getBookingRuleForPolicy() {
    const bookingRule = await this.getActiveBookingRule();
    return bookingRule ?? FALLBACK_BOOKING_RULES;
  }

  async getPriorityPolicyByGroupId(priorityGroupId: string | null): Promise<PriorityPolicyRecord | null> {
    if (!priorityGroupId) {
      return null;
    }

    return this.db.priorityPolicy.findFirst({
      where: {
        priorityGroupId,
        status: EntityStatus.ACTIVE
      },
      include: priorityPolicyInclude,
      orderBy: [{ updatedAt: "desc" }]
    });
  }

  async getEffectivePolicy(input: {
    priorityGroupId: string | null;
    priorityGroupAdvanceBookingDays: number | null;
  }): Promise<EffectiveBookingPolicy> {
    const [bookingRule, priorityPolicy] = await Promise.all([
      this.getBookingRuleForPolicy(),
      this.getPriorityPolicyByGroupId(input.priorityGroupId)
    ]);

    return {
      holdMinutes: bookingRule.holdMinutes,
      cancelBeforeHours: bookingRule.cancelBeforeHours,
      lateCheckinMinutes: bookingRule.lateCheckinMinutes,
      maxDurationMinutes: priorityPolicy?.maxDurationMinutes ?? bookingRule.maxDurationMinutes,
      maxBookingsPerDay: priorityPolicy?.maxBookingsPerDay ?? bookingRule.maxBookingsPerDay,
      advanceBookingDays:
        priorityPolicy?.advanceBookingDays ?? input.priorityGroupAdvanceBookingDays ?? null,
      canJoinWaitlist: priorityPolicy?.canJoinWaitlist ?? true,
      refundRateUserOnTime: bookingRule.refundRateUserOnTime,
      refundRateManagerFault: bookingRule.refundRateManagerFault
    };
  }
}

export const rulesRepository = new RulesRepository();
