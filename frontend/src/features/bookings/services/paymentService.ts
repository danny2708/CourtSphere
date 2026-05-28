import { apiRequest } from "../../../api/client";
import { getMockBookingById, saveMockBooking } from "./bookingService";
import type { BookingOrder, BookingPayment, PaymentStatus } from "../types/booking.types";
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

function createMockPayment(booking: BookingOrder): PaymentDetail {
  const now = new Date().toISOString();
  const gatewayTransactionId = `mock_${booking.bookingOrderId}`;
  const payment: BookingPayment = {
    id: `mock-payment-${booking.bookingOrderId}`,
    amount: booking.totalAmount,
    paymentMethod: "MOCK",
    gatewayTransactionId,
    paymentStatus: "PROCESSING",
    paymentUrl: `/mock-payment/${gatewayTransactionId}`,
    createdAt: now
  };

  saveMockBooking({
    ...booking,
    bookingStatus: "PAYMENT_PROCESSING",
    paymentStatus: "PROCESSING",
    items: booking.items.map((item) => ({
      ...item,
      bookingStatus: "PAYMENT_PROCESSING"
    })),
    payments: [payment, ...(booking.payments ?? [])],
    updatedAt: now
  });

  return {
    ...payment,
    bookingOrder: booking
  };
}

export async function createPayment(bookingOrderId: string, payload: CreatePaymentPayload): Promise<PaymentDetail> {
  if (bookingOrderId.startsWith("mock-booking-")) {
    const booking = getMockBookingById(bookingOrderId);
    if (!booking) {
      throw new Error("Không tìm thấy đơn đặt sân.");
    }

    return createMockPayment(booking);
  }

  const response = await apiRequest<{ payment: PaymentDetail }>(`/api/bookings/${bookingOrderId}/payments`, {
    auth: true,
    method: "POST",
    body: payload
  });

  return response.payment;
}

export async function confirmMockPaymentSuccess(payment: PaymentDetail): Promise<PaymentDetail> {
  if (payment.id.startsWith("mock-payment-") && payment.bookingOrder?.bookingOrderId) {
    const booking = getMockBookingById(payment.bookingOrder.bookingOrderId);
    if (!booking) {
      throw new Error("Không tìm thấy đơn đặt sân.");
    }

    const now = new Date().toISOString();
    const successPayment: BookingPayment = {
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      gatewayTransactionId: payment.gatewayTransactionId,
      paymentStatus: "SUCCESS",
      paymentUrl: payment.paymentUrl,
      paidAt: now,
      createdAt: payment.createdAt
    };

    const confirmedBooking = saveMockBooking({
      ...booking,
      bookingStatus: "CONFIRMED",
      paymentStatus: "SUCCESS",
      holdExpiresAt: null,
      payments: [successPayment, ...(booking.payments ?? []).filter((item) => item.id !== successPayment.id)],
      items: booking.items.map((item) => ({
        ...item,
        bookingStatus: "CONFIRMED"
      })),
      statusHistories: [
        ...(booking.statusHistories ?? []),
        {
          oldStatus: booking.bookingStatus,
          newStatus: "CONFIRMED",
          actionType: "PAYMENT_SUCCESS_CONFIRM_BOOKING",
          note: "Mock payment success confirmed booking",
          changedAt: now
        }
      ],
      updatedAt: now
    });

    return {
      ...successPayment,
      bookingOrder: confirmedBooking
    };
  }

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
