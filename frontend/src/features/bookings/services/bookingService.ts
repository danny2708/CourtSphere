import { apiRequest } from "../../../api/client";
import { ApiClientError } from "../../../types/api.types";
import type {
  BookingOrder,
  CancelBookingPayload,
  CreateBookingPayload,
  ListMyBookingsQuery
} from "../types/booking.types";

const MOCK_BOOKINGS_STORAGE_KEY = "courtsphere.mockBookings";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

function canUseMockForPayload(payload: CreateBookingPayload): boolean {
  return payload.items.some((item) => !isUuid(item.courtId));
}

function readMockBookings(): BookingOrder[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(MOCK_BOOKINGS_STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    return JSON.parse(rawValue) as BookingOrder[];
  } catch {
    return [];
  }
}

function writeMockBookings(bookings: BookingOrder[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MOCK_BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
}

function createMockBooking(payload: CreateBookingPayload): BookingOrder {
  const now = new Date();
  const bookingOrderId = `mock-booking-${now.getTime()}`;
  const totalAmount = payload.items.length * 180000;

  const booking: BookingOrder = {
    id: bookingOrderId,
    bookingOrderId,
    bookingCode: `MOCK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getTime()).slice(-6)}`,
    bookingStatus: "PENDING_PAYMENT",
    paymentStatus: "INITIATED",
    totalAmount,
    holdExpiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    refundable: true,
    note: payload.note ?? null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    items: payload.items.map((item, index) => ({
      id: `${bookingOrderId}-item-${index + 1}`,
      bookingItemId: `${bookingOrderId}-item-${index + 1}`,
      court: {
        id: item.courtId,
        courtName: "Sân preview",
        status: "ACTIVE"
      },
      startDatetime: item.startDatetime,
      endDatetime: item.endDatetime,
      unitPrice: 180000,
      amount: 180000,
      bookingStatus: "PENDING_PAYMENT",
      statusHistories: [
        {
          oldStatus: null,
          newStatus: "PENDING_PAYMENT",
          actionType: "USER_CREATE_BOOKING_ITEM_HOLD",
          note: "Mock booking item hold created",
          changedAt: now.toISOString()
        }
      ]
    })),
    statusHistories: [
      {
        oldStatus: null,
        newStatus: "PENDING_PAYMENT",
        actionType: "USER_CREATE_BOOKING_ORDER_HOLD",
        note: "Mock booking order hold created",
        changedAt: now.toISOString()
      }
    ],
    payments: [],
    refunds: []
  };

  const bookings = [booking, ...readMockBookings()];
  writeMockBookings(bookings);

  return booking;
}

function updateMockBooking(booking: BookingOrder): BookingOrder {
  const bookings = readMockBookings();
  const nextBookings = bookings.map((currentBooking) =>
    currentBooking.bookingOrderId === booking.bookingOrderId ? booking : currentBooking
  );
  writeMockBookings(nextBookings);

  return booking;
}

export function getMockBookingById(bookingOrderId: string): BookingOrder | null {
  return readMockBookings().find((booking) => booking.bookingOrderId === bookingOrderId) ?? null;
}

export function saveMockBooking(booking: BookingOrder): BookingOrder {
  return updateMockBooking(booking);
}

export async function createBooking(payload: CreateBookingPayload): Promise<BookingOrder> {
  if (canUseMockForPayload(payload)) {
    return createMockBooking(payload);
  }

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

  try {
    const response = await apiRequest<{ bookings: BookingOrder[] }>(`/api/bookings/my${params.size ? `?${params.toString()}` : ""}`, {
      auth: true,
      method: "GET"
    });

    return [...readMockBookings(), ...response.bookings];
  } catch (error) {
    if (import.meta.env.DEV && !(error instanceof ApiClientError && (error.status === 401 || error.status === 403))) {
      return readMockBookings();
    }

    throw error;
  }
}

export async function getBookingDetail(bookingOrderId: string): Promise<BookingOrder> {
  if (bookingOrderId.startsWith("mock-booking-")) {
    const booking = getMockBookingById(bookingOrderId);
    if (booking) {
      return booking;
    }
  }

  const response = await apiRequest<{ booking: BookingOrder }>(`/api/bookings/${bookingOrderId}`, {
    auth: true,
    method: "GET"
  });

  return response.booking;
}

export async function cancelBooking(bookingOrderId: string, payload: CancelBookingPayload): Promise<BookingOrder> {
  if (bookingOrderId.startsWith("mock-booking-")) {
    const booking = getMockBookingById(bookingOrderId);
    if (!booking) {
      throw new Error("Không tìm thấy đơn đặt sân.");
    }

    if (booking.bookingStatus !== "PENDING_PAYMENT" && booking.bookingStatus !== "CONFIRMED") {
      throw new Error("Bạn không thể hủy đơn này ở trạng thái hiện tại.");
    }

    const now = new Date().toISOString();
    const cancelledBooking: BookingOrder = {
      ...booking,
      bookingStatus: "CANCELLED_BY_USER",
      paymentStatus: booking.bookingStatus === "PENDING_PAYMENT" ? "CANCELLED" : booking.paymentStatus,
      cancelReason: payload.reason ?? null,
      cancelledAt: now,
      holdExpiresAt: null,
      updatedAt: now,
      items: booking.items.map((item) => ({
        ...item,
        bookingStatus: "CANCELLED_BY_USER",
        statusHistories: [
          ...(item.statusHistories ?? []),
          {
            oldStatus: item.bookingStatus,
            newStatus: "CANCELLED_BY_USER",
            actionType: "USER_CANCEL_BOOKING_ITEM",
            note: payload.reason ?? null,
            changedAt: now
          }
        ]
      })),
      statusHistories: [
        ...(booking.statusHistories ?? []),
        {
          oldStatus: booking.bookingStatus,
          newStatus: "CANCELLED_BY_USER",
          actionType: "USER_CANCEL_BOOKING_ORDER",
          note: payload.reason ?? null,
          changedAt: now
        }
      ]
    };

    return updateMockBooking(cancelledBooking);
  }

  const response = await apiRequest<{ booking: BookingOrder }>(`/api/bookings/${bookingOrderId}/cancel`, {
    auth: true,
    method: "POST",
    body: payload
  });

  return response.booking;
}
