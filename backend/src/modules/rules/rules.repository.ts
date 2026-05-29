import { EntityStatus, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../config/prisma";
import type { EffectiveBookingPolicy } from "./rules.types";

type RulesDbClient =
  | Pick<PrismaClient, "bookingRule" | "priorityPolicy" | "systemSetting">
  | Prisma.TransactionClient;

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
export const FALLBACK_WAITLIST_RESPONSE_MINUTES = 10;
export const FALLBACK_NO_SHOW_PENALTY_POINTS = 1;
export const FALLBACK_LATE_CANCELLATION_VIOLATION_ENABLED = true;
export const FALLBACK_LATE_CANCELLATION_PENALTY_POINTS = 1;

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
  constructor(private readonly db: RulesDbClient = prisma) {}

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

  async getWaitlistResponseMinutes(): Promise<number> {
    return this.getPositiveIntegerSetting(
      "waitlist_response_minutes",
      FALLBACK_WAITLIST_RESPONSE_MINUTES
    );
  }

  async getNoShowPenaltyPoints(): Promise<number> {
    return this.getPositiveIntegerSetting(
      "no_show_penalty_points",
      FALLBACK_NO_SHOW_PENALTY_POINTS
    );
  }

  async getLateCancellationViolationConfig(): Promise<{
    enabled: boolean;
    penaltyPoints: number;
  }> {
    const [enabledSetting, penaltyPoints] = await Promise.all([
      this.db.systemSetting.findUnique({
        where: { settingKey: "late_cancellation_violation_enabled" },
        select: { settingValue: true }
      }),
      this.getPositiveIntegerSetting(
        "late_cancellation_penalty_points",
        FALLBACK_LATE_CANCELLATION_PENALTY_POINTS
      )
    ]);

    return {
      enabled:
        enabledSetting?.settingValue === undefined
          ? FALLBACK_LATE_CANCELLATION_VIOLATION_ENABLED
          : enabledSetting.settingValue.toLowerCase() === "true",
      penaltyPoints
    };
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

  private async getPositiveIntegerSetting(settingKey: string, fallback: number): Promise<number> {
    const setting = await this.db.systemSetting.findUnique({
      where: { settingKey },
      select: { settingValue: true }
    });
    const parsedValue = Number.parseInt(setting?.settingValue ?? "", 10);

    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
  }
}

export const rulesRepository = new RulesRepository();
