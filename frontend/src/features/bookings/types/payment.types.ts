import type { BookingOrder, PaymentStatus } from "./booking.types";

export type CreatePaymentPayload = {
  amount: number;
  paymentMethod?: "MOCK" | "MOMO";
};

export type PaymentDetail = {
  id: string;
  amount: number;
  paymentMethod: string;
  gatewayTransactionId: string;
  paymentStatus: PaymentStatus;
  paymentUrl?: string;
  paidAt?: string | null;
  createdAt?: string;
  bookingOrder?: Pick<BookingOrder, "id" | "bookingOrderId" | "bookingCode" | "bookingStatus" | "paymentStatus" | "totalAmount" | "items">;
};

export type MockPaymentCallbackPayload = {
  gatewayTransactionId: string;
  status: Extract<PaymentStatus, "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED">;
  signature: string;
};

export type MomoPaymentReturnPayload = Record<string, string>;
