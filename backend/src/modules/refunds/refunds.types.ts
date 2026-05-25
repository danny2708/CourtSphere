import type { RefundStatus } from "@prisma/client";

export type AdminListRefundsQuery = {
  refundStatus?: RefundStatus;
  fromDate?: Date;
  toDate?: Date;
  bookingCode?: string;
  userId?: string;
  paymentId?: string;
};

export type RetryRefundInput = {
  mockResult?: Extract<RefundStatus, "SUCCESS" | "FAILED" | "MANUAL_REVIEW">;
  reason?: string;
};

export type ManagerCancelBookingInput = {
  reason: string;
};

export type AuditContext = {
  actorUserId: string;
  roles: string[];
  ipAddress?: string;
  userAgent?: string;
};
