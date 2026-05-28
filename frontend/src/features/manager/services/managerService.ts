import { apiRequest } from "../../../api/client";
import { ApiClientError } from "../../../types/api.types";
import { mockCourts } from "../../courts/data/mockCourts";
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

const MANAGER_MOCK_STORAGE_KEY = "courtsphere.manager.mockItems";

function isAuthError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403);
}

function canUseMockFallback(error: unknown): boolean {
  return import.meta.env.DEV && !isAuthError(error);
}

function buildDateTime(hours: number, minutes = 0): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

  return date.toISOString();
}

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

function buildDefaultMockItems(): ManagerBookingItemViewModel[] {
  return [
    mapBookingItem({
      bookingItemId: "mock-manager-item-confirmed",
      bookingOrderId: "mock-manager-order-confirmed",
      bookingCode: "BK-MOCK-CHECKIN",
      court: { id: "court-football-01", courtName: "Sân bóng đá trung tâm", status: "ACTIVE", courtType: { typeName: "Bóng đá" } },
      user: { fullName: "Nguyễn Văn A", email: "user@example.com" },
      startDatetime: buildDateTime(8),
      endDatetime: buildDateTime(9),
      amount: 180000,
      itemStatus: "CONFIRMED",
      paymentStatus: "SUCCESS"
    }),
    mapBookingItem({
      bookingItemId: "mock-manager-item-in-use",
      bookingOrderId: "mock-manager-order-in-use",
      bookingCode: "BK-MOCK-INUSE",
      court: { id: "court-badminton-02", courtName: "Sân cầu lông nhà thi đấu", status: "ACTIVE", courtType: { typeName: "Cầu lông" } },
      user: { fullName: "Trần Thị B", email: "student@example.com" },
      startDatetime: buildDateTime(10),
      endDatetime: buildDateTime(11),
      amount: 90000,
      itemStatus: "IN_USE",
      paymentStatus: "SUCCESS"
    }),
    mapBookingItem({
      bookingItemId: "mock-manager-item-expired",
      bookingOrderId: "mock-manager-order-expired",
      bookingCode: "BK-MOCK-NOSHOW",
      court: { id: "court-tennis-03", courtName: "Sân tennis ngoài trời", status: "ACTIVE", courtType: { typeName: "Tennis" } },
      user: { fullName: "Lê Minh C", email: "late@example.com" },
      startDatetime: buildDateTime(13),
      endDatetime: buildDateTime(14),
      amount: 150000,
      itemStatus: "CHECKIN_EXPIRED",
      paymentStatus: "SUCCESS"
    })
  ];
}

function getStoredMockItems(): ManagerBookingItemViewModel[] {
  const rawValue = window.localStorage.getItem(MANAGER_MOCK_STORAGE_KEY);

  if (!rawValue) {
    const defaultItems = buildDefaultMockItems();
    window.localStorage.setItem(MANAGER_MOCK_STORAGE_KEY, JSON.stringify(defaultItems));
    return defaultItems;
  }

  try {
    return JSON.parse(rawValue) as ManagerBookingItemViewModel[];
  } catch {
    const defaultItems = buildDefaultMockItems();
    window.localStorage.setItem(MANAGER_MOCK_STORAGE_KEY, JSON.stringify(defaultItems));
    return defaultItems;
  }
}

function saveMockItems(items: ManagerBookingItemViewModel[]): void {
  window.localStorage.setItem(MANAGER_MOCK_STORAGE_KEY, JSON.stringify(items));
}

function updateMockItem(bookingItemId: string, status: ManagerBookingItemStatus, note?: string): ManagerBookingItemViewModel {
  const items = getStoredMockItems();
  const updatedItems = items.map((item) =>
    item.bookingItemId === bookingItemId
      ? {
          ...item,
          status,
          checkinTime: status === "IN_USE" ? new Date().toISOString() : item.checkinTime,
          managerNote: note ?? item.managerNote
        }
      : item
  );
  saveMockItems(updatedItems);

  const updatedItem = updatedItems.find((item) => item.bookingItemId === bookingItemId);
  if (!updatedItem) {
    throw new Error("Không tìm thấy booking item mock.");
  }

  return updatedItem;
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

  try {
    const response = await apiRequest<ManagerScheduleResponse>(
      `/api/manager/bookings/today${params.toString() ? `?${params.toString()}` : ""}`,
      { auth: true, method: "GET" }
    );

    return extractBookingItems(response).map(mapBookingItem);
  } catch (error) {
    if (!canUseMockFallback(error)) {
      throw error;
    }

    return getStoredMockItems().filter((item) => {
      const byCourt = query.courtId ? item.courtId === query.courtId : true;
      const byStatus = query.status ? item.status === query.status : true;
      return byCourt && byStatus;
    });
  }
}

export async function checkInBookingItem(bookingItemId: string): Promise<ManagerBookingItemViewModel> {
  if (bookingItemId.startsWith("mock-manager-item-")) {
    return updateMockItem(bookingItemId, "IN_USE");
  }

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
  if (bookingItemId.startsWith("mock-manager-item-")) {
    return updateMockItem(bookingItemId, "IN_USE", payload.reason);
  }

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
  if (bookingItemId.startsWith("mock-manager-item-")) {
    return updateMockItem(bookingItemId, "NO_SHOW", payload.reason);
  }

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
  if (bookingItemId.startsWith("mock-manager-item-")) {
    return updateMockItem(bookingItemId, "COMPLETED", payload.reason);
  }

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
  if (bookingOrderId.startsWith("mock-manager-order-")) {
    const items = getStoredMockItems().map((item) =>
      item.bookingOrderId === bookingOrderId ? { ...item, status: "CANCELLED_BY_MANAGER" as const, managerNote: payload.reason } : item
    );
    saveMockItems(items);
    return {
      bookingOrder: {
        bookingOrderId,
        bookingStatus: "CANCELLED_BY_MANAGER",
        cancelReason: payload.reason,
        refundable: true
      },
      refund: {
        id: `mock-refund-${Date.now()}`,
        refundAmount: items.find((item) => item.bookingOrderId === bookingOrderId)?.amount,
        refundStatus: "REQUESTED"
      }
    };
  }

  return apiRequest<ManagerCancelBookingResponse>(`/api/manager/bookings/${bookingOrderId}/cancel`, {
    auth: true,
    body: { reason: payload.reason ?? "" },
    method: "POST"
  });
}

export async function listManagerCourts(): Promise<ManagerCourtViewModel[]> {
  try {
    const response = await apiRequest<CourtsResponse>("/api/courts", { auth: true, method: "GET" });
    return extractCourts(response).map(mapCourt);
  } catch (error) {
    if (!canUseMockFallback(error)) {
      throw error;
    }

    return mockCourts.map((court) => ({
      id: court.id,
      name: court.name,
      status: court.status,
      courtTypeName: court.tags[0],
      description: court.description,
      imageUrl: court.imageUrl
    }));
  }
}

export async function updateCourtStatus(input: {
  courtId: string;
  status: ManagerCourtStatus;
  reason?: string;
}): Promise<ManagerCourtViewModel> {
  if (input.courtId.startsWith("court-")) {
    return {
      id: input.courtId,
      name: mockCourts.find((court) => court.id === input.courtId)?.name ?? "Sân thể thao",
      status: input.status,
      courtTypeName: mockCourts.find((court) => court.id === input.courtId)?.tags[0]
    };
  }

  const response = await apiRequest<{ court: ApiCourt }>(`/api/admin/courts/${input.courtId}/status`, {
    auth: true,
    body: { reason: input.reason ?? "", status: input.status },
    method: "PATCH"
  });

  return mapCourt(response.court);
}
