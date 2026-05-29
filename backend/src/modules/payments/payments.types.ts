import type { PaymentStatus } from "@prisma/client";

export type CreatePaymentInput = {
  amount: number;
  paymentMethod?: "MOCK" | "MOMO";
};

export type MockPaymentCallbackInput = {
  gatewayTransactionId: string;
  status: Extract<PaymentStatus, "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED">;
  signature: string;
};

export type MomoPaymentCallbackInput = {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: string;
  orderInfo: string;
  orderType: string;
  transId: string;
  resultCode: string;
  message: string;
  payType: string;
  responseTime: string;
  extraData: string;
  signature: string;
  [key: string]: unknown;
};

export type AdminListPaymentsQuery = {
  status?: PaymentStatus;
  fromDate?: Date;
  toDate?: Date;
  bookingCode?: string;
  userId?: string;
};
