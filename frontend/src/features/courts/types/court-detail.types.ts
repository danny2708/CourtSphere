import type { CourtCardViewModel } from "../../../types/court.types";

export type CourtOperatingHour = {
  weekday: string;
  openTime: string;
  closeTime: string;
};

export type CourtDetailViewModel = CourtCardViewModel & {
  courtType: string;
  area: string;
  capacity: number;
  description: string;
  amenities: string[];
  operatingHours: CourtOperatingHour[];
  gallery: string[];
};

export type CourtSortOption = "name_asc" | "capacity_asc" | "capacity_desc" | "available_first";
