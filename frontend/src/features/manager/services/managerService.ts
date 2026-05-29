import { apiRequest } from "../../../api/client";
import type {
  ManagerActionPayload,
  ManagerBookingItemStatus,
  ManagerBookingItemViewModel,
  ManagerCancelBookingResponse,
  ManagerCourtStatus,
  ManagerCourtViewModel
} from "../types/manager.types";

type ApiManagerBookingItem = {
  id?: string;
  bookingItemId?: string;
  bookingOrderId?: string;
  bookingCode?: string;
  court?: {
    id?: string;
    courtName?: string;
    status?: ManagerCourtStatus;
    courtType?: {
      id?: string;
      typeName?: string;
    } | null;
  } | null;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
  } | null;
  startDatetime?: string;
  endDatetime?: string;
  unitPrice?: number;
  amount?: number;
  itemStatus?: ManagerBookingItemStatus;
  bookingStatus?: ManagerBookingItemStatus;
  paymentStatus?: string;
  checkinTime?: string | null;
  managerNote?: string | null;
};

type ApiCourt = {
  id?: string;
  courtId?: string;
  courtName?: string;
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  status?: ManagerCourtStatus;
  courtType?: {
    typeName?: string;
  } | null;
};

type ManagerScheduleResponse = {
  bookingItems?: ApiManagerBookingItem[];
  data?: {
    bookingItems?: ApiManagerBookingItem[];
  };
};

type CourtsResponse = {
  courts?: ApiCourt[];
  data?: ApiCourt[] | { items?: ApiCourt[]; courts?: ApiCourt[] };
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit"
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function toMoneyText(value: number | undefined): string | undefined {
  return value === undefined ? undefined : currencyFormatter.format(value);
}

function mapBookingItem(item: ApiManagerBookingItem): ManagerBookingItemViewModel {
  const startDatetime = item.startDatetime ?? new Date().toISOString();
  const endDatetime = item.endDatetime ?? new Date(Date.now() + 60 * 60_000).toISOString();
  const startDate = new Date(startDatetime);
  const endDate = new Date(endDatetime);
  const status = item.itemStatus ?? item.bookingStatus ?? "CONFIRMED";

  return {
    bookingOrderId: item.bookingOrderId ?? "unknown-order",
    bookingItemId: item.bookingItemId ?? item.id ?? "unknown-item",
    bookingCode: item.bookingCode,
    userName: item.user?.fullName,
    userEmail: item.user?.email,
    courtId: item.court?.id ?? "unknown-court",
    courtName: item.court?.courtName,
    courtTypeName: item.court?.courtType?.typeName,
    courtStatus: item.court?.status,
    startDatetime,
    endDatetime,
    startTimeText: timeFormatter.format(startDate),
    endTimeText: timeFormatter.format(endDate),
    dateText: dateFormatter.format(startDate),
    status,
    paymentStatus: item.paymentStatus as ManagerBookingItemViewModel["paymentStatus"],
    unitPrice: item.unitPrice,
    amount: item.amount,
    amountText: toMoneyText(item.amount),
    checkinTime: item.checkinTime ?? null,
    managerNote: item.managerNote ?? null
  };
}

function mapCourt(court: ApiCourt): ManagerCourtViewModel {
  return {
    id: court.id ?? court.courtId ?? "unknown-court",
    name: court.courtName ?? court.name ?? "Sân thể thao",
    status: court.status ?? "ACTIVE",
    courtTypeName: court.courtType?.typeName,
    description: court.description,
    imageUrl: court.imageUrl
  };
}

function extractBookingItems(response: ManagerScheduleResponse): ApiManagerBookingItem[] {
  return response.bookingItems ?? response.data?.bookingItems ?? [];
}

function extractCourts(response: CourtsResponse): ApiCourt[] {
  if (Array.isArray(response.data)) {
    return response.data;
  }

  return response.courts ?? response.data?.items ?? response.data?.courts ?? [];
}

export async function getManagerTodaySchedule(query: {
  courtId?: string;
  status?: ManagerBookingItemStatus;
} = {}): Promise<ManagerBookingItemViewModel[]> {
  const params = new URLSearchParams();
  if (query.courtId) {
    params.set("courtId", query.courtId);
  }
  if (query.status) {
    params.set("status", query.status);
  }

  const response = await apiRequest<ManagerScheduleResponse>(
    `/api/manager/bookings/today${params.toString() ? `?${params.toString()}` : ""}`,
    { auth: true, method: "GET" }
  );

  return extractBookingItems(response).map(mapBookingItem);
}

export async function checkInBookingItem(bookingItemId: string): Promise<ManagerBookingItemViewModel> {
  const response = await apiRequest<{ bookingItem: ApiManagerBookingItem }>(
    `/api/manager/booking-items/${bookingItemId}/check-in`,
    { auth: true, method: "POST" }
  );

  return mapBookingItem(response.bookingItem);
}

export async function overrideLateCheckIn(
  bookingItemId: string,
  payload: ManagerActionPayload
): Promise<ManagerBookingItemViewModel> {
  const response = await apiRequest<{ bookingItem: ApiManagerBookingItem }>(
    `/api/manager/booking-items/${bookingItemId}/override-checkin`,
    { auth: true, body: { reason: payload.reason ?? "" }, method: "POST" }
  );

  return mapBookingItem(response.bookingItem);
}

export async function markNoShow(
  bookingItemId: string,
  payload: ManagerActionPayload
): Promise<ManagerBookingItemViewModel> {
  const response = await apiRequest<{ bookingItem: ApiManagerBookingItem }>(
    `/api/manager/booking-items/${bookingItemId}/no-show`,
    { auth: true, body: { reason: payload.reason ?? "" }, method: "POST" }
  );

  return mapBookingItem(response.bookingItem);
}

export async function overrideComplete(
  bookingItemId: string,
  payload: ManagerActionPayload
): Promise<ManagerBookingItemViewModel> {
  const response = await apiRequest<{ bookingItem: ApiManagerBookingItem }>(
    `/api/manager/booking-items/${bookingItemId}/override-complete`,
    { auth: true, body: { reason: payload.reason ?? "" }, method: "POST" }
  );

  return mapBookingItem(response.bookingItem);
}

export async function managerCancelBooking(
  bookingOrderId: string,
  payload: ManagerActionPayload
): Promise<ManagerCancelBookingResponse> {
  return apiRequest<ManagerCancelBookingResponse>(`/api/manager/bookings/${bookingOrderId}/cancel`, {
    auth: true,
    body: { reason: payload.reason ?? "" },
    method: "POST"
  });
}

export async function listManagerCourts(): Promise<ManagerCourtViewModel[]> {
  const response = await apiRequest<CourtsResponse>("/api/courts", { auth: true, method: "GET" });
  return extractCourts(response).map(mapCourt);
}

export async function updateCourtStatus(input: {
  courtId: string;
  status: ManagerCourtStatus;
  reason?: string;
}): Promise<ManagerCourtViewModel> {
  const response = await apiRequest<{ court: ApiCourt }>(`/api/admin/courts/${input.courtId}/status`, {
    auth: true,
    body: { reason: input.reason ?? "", status: input.status },
    method: "PATCH"
  });

  return mapCourt(response.court);
}
