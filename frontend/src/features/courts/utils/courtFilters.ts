import type { CourtFilterState } from "../../../types/court.types";
import type { CourtDetailViewModel, CourtSortOption } from "../types/court-detail.types";

export const defaultCourtFilters: CourtFilterState = {
  courtTypes: [],
  statuses: [],
  areas: [],
  priceRange: [0, 500000],
  timeSlots: [],
  favoritesOnly: false
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesOneTimeSlot(court: CourtDetailViewModel, timeSlot: string): boolean {
  if (timeSlot === "Sáng") {
    return Boolean(court.openTime && court.openTime <= "12:00");
  }

  if (timeSlot === "Chiều") {
    return Boolean(court.openTime && court.closeTime && court.openTime <= "17:00" && court.closeTime >= "13:00");
  }

  if (timeSlot === "Tối") {
    return Boolean(court.closeTime && court.closeTime >= "18:00");
  }

  return true;
}

function matchesTimeSlots(court: CourtDetailViewModel, timeSlots: string[]): boolean {
  return timeSlots.length === 0 || timeSlots.some((timeSlot) => matchesOneTimeSlot(court, timeSlot));
}

export function filterCourts(
  courts: CourtDetailViewModel[],
  searchKeyword: string,
  filters: CourtFilterState
): CourtDetailViewModel[] {
  const keyword = normalize(searchKeyword);

  return courts.filter((court) => {
    const searchableText = [court.name, court.courtType, court.area ?? "", court.address ?? "", ...court.tags].join(" ");
    const matchesKeyword = !keyword || normalize(searchableText).includes(keyword);
    const matchesType = filters.courtTypes.length === 0 || filters.courtTypes.includes(court.courtType);
    const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(court.status);
    const matchesArea = filters.areas.length === 0 || Boolean(court.area && filters.areas.includes(court.area));
    const matchesFavorite = !filters.favoritesOnly || court.isFavorite;
    const price = court.startingPrice ?? 0;
    const matchesPrice = price >= filters.priceRange[0] && price <= filters.priceRange[1];

    return matchesKeyword && matchesType && matchesStatus && matchesArea && matchesFavorite && matchesPrice && matchesTimeSlots(court, filters.timeSlots);
  });
}

export function sortCourts(courts: CourtDetailViewModel[], sortBy: CourtSortOption): CourtDetailViewModel[] {
  const sortedCourts = [...courts];

  if (sortBy === "name_asc") {
    return sortedCourts.sort((first, second) => first.name.localeCompare(second.name, "vi"));
  }

  return sortedCourts.sort((first, second) => Number(second.status === "ACTIVE") - Number(first.status === "ACTIVE"));
}
