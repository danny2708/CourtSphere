import type { ViolationType } from "@prisma/client";

export type ListViolationsQuery = {
  userId?: string;
  violationType?: ViolationType;
  isWaived?: boolean;
  fromDate?: Date;
  toDate?: Date;
  bookingItemId?: string;
};

export type WaiveViolationInput = {
  reason: string;
};

export type AdjustViolationPointsInput = {
  penaltyPoints: number;
  reason: string;
};

export type AuditContext = {
  actorUserId: string;
  roles: string[];
  ipAddress?: string;
  userAgent?: string;
};
