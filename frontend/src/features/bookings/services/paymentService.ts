import { apiRequest } from "../../../api/client";
import type { CreatePaymentPayload, MomoPaymentReturnPayload, PaymentDetail } from "../types/payment.types";

export async function createPayment(bookingOrderId: string, payload: CreatePaymentPayload): Promise<PaymentDetail> {
  if (bookingOrderId.startsWith("mock-booking-")) {
    throw new Error("Đơn mock chỉ lưu trong trình duyệt nên không thể thanh toán qua MoMo. Hãy tạo đơn từ sân thật để thanh toán sandbox.");
  }

  const response = await apiRequest<{ payment: PaymentDetail }>(`/api/bookings/${bookingOrderId}/payments`, {
    auth: true,
    method: "POST",
    body: payload
  });

  return response.payment;
}

export async function handleMomoPaymentReturn(payload: MomoPaymentReturnPayload): Promise<PaymentDetail> {
  const response = await apiRequest<{ payment: PaymentDetail }>("/api/payments/callback/momo", {
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
