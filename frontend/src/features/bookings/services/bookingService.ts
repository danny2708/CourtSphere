import { apiRequest } from "../../../api/client";
import type {
  BookingOrder,
  CancelBookingPayload,
  CreateBookingPayload,
  ListMyBookingsQuery
} from "../types/booking.types";

export async function createBooking(payload: CreateBookingPayload): Promise<BookingOrder> {
  const response = await apiRequest<{ booking: BookingOrder }>("/api/bookings", {
    auth: true,
    method: "POST",
    body: payload
  });

  return response.booking;
}

export async function listMyBookings(query: ListMyBookingsQuery = {}): Promise<BookingOrder[]> {
  const params = new URLSearchParams();

  if (query.status) {
    params.set("status", query.status);
  }

  if (query.fromDate) {
    params.set("fromDate", query.fromDate);
  }

  if (query.toDate) {
    params.set("toDate", query.toDate);
  }

  const response = await apiRequest<{ bookings: BookingOrder[] }>(`/api/bookings/my${params.size ? `?${params.toString()}` : ""}`, {
    auth: true,
    method: "GET"
  });

  return response.bookings;
}

export async function getBookingDetail(bookingOrderId: string): Promise<BookingOrder> {
  const response = await apiRequest<{ booking: BookingOrder }>(`/api/bookings/${bookingOrderId}`, {
    auth: true,
    method: "GET"
  });

  return response.booking;
}

export async function cancelBooking(bookingOrderId: string, payload: CancelBookingPayload): Promise<BookingOrder> {
  const response = await apiRequest<{ booking: BookingOrder }>(`/api/bookings/${bookingOrderId}/cancel`, {
    auth: true,
    method: "POST",
    body: payload
  });

  return response.booking;
}
