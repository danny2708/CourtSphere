import { apiRequest } from "../../../api/client";
import type { PaymentStatus } from "../types/booking.types";
import type { CreatePaymentPayload, MockPaymentCallbackPayload, PaymentDetail } from "../types/payment.types";

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signMockCallback(input: { gatewayTransactionId: string; status: PaymentStatus }): Promise<string | null> {
  const secret = import.meta.env.VITE_MOCK_PAYMENT_SECRET;

  if (!secret || !crypto.subtle) {
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${input.gatewayTransactionId}:${input.status}`));

  return bytesToHex(signature);
}

export async function createPayment(bookingOrderId: string, payload: CreatePaymentPayload): Promise<PaymentDetail> {
  const response = await apiRequest<{ payment: PaymentDetail }>(`/api/bookings/${bookingOrderId}/payments`, {
    auth: true,
    method: "POST",
    body: payload
  });

  return response.payment;
}

export async function confirmMockPaymentSuccess(payment: PaymentDetail): Promise<PaymentDetail> {
  const signature = await signMockCallback({
    gatewayTransactionId: payment.gatewayTransactionId,
    status: "SUCCESS"
  });

  if (!signature) {
    throw new Error("Chưa cấu hình VITE_MOCK_PAYMENT_SECRET để xác nhận callback mock từ frontend.");
  }

  const payload: MockPaymentCallbackPayload = {
    gatewayTransactionId: payment.gatewayTransactionId,
    status: "SUCCESS",
    signature
  };

  const response = await apiRequest<{ payment: PaymentDetail }>("/api/payments/callback/mock", {
    method: "POST",
    body: payload
  });

  return response.payment;
}

export async function getPaymentDetail(paymentId: string): Promise<PaymentDetail> {
  const response = await apiRequest<{ payment: PaymentDetail }>(`/api/payments/${paymentId}`, {
    auth: true,
    method: "GET"
  });

  return response.payment;
}
