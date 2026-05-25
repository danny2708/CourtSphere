import type { BookingStatus } from "@prisma/client";

export type ManagerTodayScheduleQuery = {
  courtId?: string;
  status?: BookingStatus;
};

export type ManagerReasonInput = {
  reason: string;
};

export type ManagerNoShowInput = {
  reason?: string;
};

export type AuditContext = {
  actorUserId: string;
  roles: string[];
  ipAddress?: string;
  userAgent?: string;
};
