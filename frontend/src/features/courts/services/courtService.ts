import { mockCourts } from "../data/mockCourts";
import type { CourtDetailViewModel } from "../types/court-detail.types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function listCourts(options: { simulateError?: boolean } = {}): Promise<CourtDetailViewModel[]> {
  await delay(180);

  if (options.simulateError) {
    throw new Error("Không tải được dữ liệu sân. Vui lòng thử lại.");
  }

  return mockCourts;
}

export async function getCourtById(courtId: string): Promise<CourtDetailViewModel | null> {
  await delay(120);

  return mockCourts.find((court) => court.id === courtId) ?? null;
}
