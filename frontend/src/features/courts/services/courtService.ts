import { apiRequest } from "../../../api/client";
import { ApiClientError } from "../../../types/api.types";
import { mockCourts } from "../data/mockCourts";
import type { CourtDetailViewModel } from "../types/court-detail.types";

type ApiCourt = {
  id: string;
  courtName: string;
  description?: string | null;
  imageUrl?: string | null;
  status: CourtDetailViewModel["status"];
  courtType?: {
    id: string;
    typeName: string;
  } | null;
  operatingHours?: Array<{
    weekday: number;
    openTime: string;
    closeTime: string;
    status?: string;
  }>;
  pricingRules?: Array<{
    priceAmount: string | number;
    status?: string;
  }>;
};

type CourtsApiResponse = {
  courts: ApiCourt[];
};

type CourtDetailApiResponse = {
  court: ApiCourt;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isUuid(value: string): boolean {
  return uuidPattern.test(value);
}

function canUseMockFallback(error: unknown): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  if (error instanceof ApiClientError) {
    return [400, 401, 403, 404].includes(error.status);
  }

  return true;
}

function weekdayText(weekday: number): string {
  const labels: Record<number, string> = {
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
    7: "Chủ nhật"
  };

  return labels[weekday] ?? `Ngày ${weekday}`;
}

function getOpenTime(court: ApiCourt): string {
  return court.operatingHours?.find((hour) => hour.status !== "INACTIVE")?.openTime ?? "06:00";
}

function getCloseTime(court: ApiCourt): string {
  return court.operatingHours?.find((hour) => hour.status !== "INACTIVE")?.closeTime ?? "22:00";
}

function getStartingPrice(court: ApiCourt): number | undefined {
  const prices = court.pricingRules
    ?.filter((rule) => rule.status !== "INACTIVE")
    .map((rule) => Number(rule.priceAmount))
    .filter((price) => Number.isFinite(price));

  if (!prices?.length) {
    return undefined;
  }

  return Math.min(...prices);
}

function mapApiCourt(court: ApiCourt): CourtDetailViewModel {
  const courtType = court.courtType?.typeName ?? "Sân thể thao";
  const openTime = getOpenTime(court);
  const closeTime = getCloseTime(court);

  return {
    id: court.id,
    name: court.courtName,
    courtType,
    area: "CourtSphere Campus",
    capacity: 12,
    rating: 4.6,
    address: "CourtSphere Campus",
    openTime,
    closeTime,
    startingPrice: getStartingPrice(court),
    status: court.status,
    tags: [courtType],
    amenities: ["Đèn chiếu sáng", "Khu chờ", "Quản lý sân"],
    description: court.description ?? `${court.courtName} thuộc hệ thống sân CourtSphere.`,
    imageUrl: court.imageUrl ?? undefined,
    operatingHours: court.operatingHours?.length
      ? court.operatingHours
          .filter((hour) => hour.status !== "INACTIVE")
          .map((hour) => ({
            weekday: weekdayText(hour.weekday),
            openTime: hour.openTime,
            closeTime: hour.closeTime
          }))
      : [{ weekday: "Thứ 2 - Chủ nhật", openTime, closeTime }],
    gallery: []
  };
}

export async function listCourts(options: { simulateError?: boolean } = {}): Promise<CourtDetailViewModel[]> {
  if (options.simulateError) {
    await delay(180);
    throw new Error("Không tải được dữ liệu sân. Vui lòng thử lại.");
  }

  try {
    const response = await apiRequest<CourtsApiResponse>("/api/courts", {
      auth: true,
      method: "GET",
      skipAuthRedirect: true
    });

    return response.courts.map(mapApiCourt);
  } catch (error) {
    if (canUseMockFallback(error)) {
      await delay(180);
      return mockCourts;
    }

    throw error;
  }
}

export async function getCourtById(courtId: string): Promise<CourtDetailViewModel | null> {
  if (!isUuid(courtId)) {
    await delay(120);
    return mockCourts.find((court) => court.id === courtId) ?? null;
  }

  try {
    const response = await apiRequest<CourtDetailApiResponse>(`/api/courts/${courtId}`, {
      auth: true,
      method: "GET",
      skipAuthRedirect: true
    });

    return mapApiCourt(response.court);
  } catch (error) {
    if (canUseMockFallback(error)) {
      await delay(120);
      return mockCourts.find((court) => court.id === courtId) ?? null;
    }

    throw error;
  }
}