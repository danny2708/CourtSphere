import type { EntityStatus } from "@prisma/client";

export type BookingRulesInput = {
  maxBookingsPerDay?: number;
  maxDurationMinutes?: number;
  holdMinutes?: number;
  cancelBeforeHours?: number;
  lateCheckinMinutes?: number;
  violationThreshold?: number;
  bookingBanDays?: number;
  refundRateUserOnTime?: number;
  refundRateManagerFault?: number;
};

export type PriorityGroupInput = {
  groupName?: string;
  groupCode?: string;
  priorityLevel?: number;
  advanceBookingDays?: number;
  description?: string | null;
  status?: EntityStatus;
};

export type PriorityPolicyInput = {
  priorityGroupId?: string;
  priorityRank?: number;
  advanceBookingDays?: number;
  maxBookingsPerDay?: number | null;
  canJoinWaitlist?: boolean;
  status?: EntityStatus;
};

export type AuditContext = {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
};

export type EffectiveBookingPolicy = {
  holdMinutes: number;
  cancelBeforeHours: number;
  lateCheckinMinutes: number;
  maxDurationMinutes: number;
  maxBookingsPerDay: number;
  advanceBookingDays: number | null;
  canJoinWaitlist: boolean;
  refundRateUserOnTime: number;
  refundRateManagerFault: number;
};
