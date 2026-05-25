import type { PaymentStatus } from "@prisma/client";

export type CreatePaymentInput = {
  amount: number;
};

export type MockPaymentCallbackInput = {
  gatewayTransactionId: string;
  status: Extract<PaymentStatus, "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED">;
  signature: string;
};

export type AdminListPaymentsQuery = {
  status?: PaymentStatus;
  fromDate?: Date;
  toDate?: Date;
  bookingCode?: string;
  userId?: string;
};

