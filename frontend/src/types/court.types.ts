export type CourtStatus = "ACTIVE" | "MAINTENANCE" | "TEMP_CLOSED" | "RETIRED";

export type CourtCardViewModel = {
  id: string;
  name: string;
  imageUrl?: string;
  logoUrl?: string;
  rating?: number;
  distanceText?: string;
  address?: string;
  openTime?: string;
  closeTime?: string;
  status: CourtStatus;
  tags: string[];
  hasPromotion?: boolean;
  isFavorite?: boolean;
};

export type CourtFilterState = {
  courtTypes: string[];
  statuses: CourtStatus[];
  priceRange: [number, number];
  timeSlot: string;
  favoritesOnly: boolean;
};
