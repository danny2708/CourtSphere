export type CourtStatus = "ACTIVE" | "MAINTENANCE" | "TEMP_CLOSED" | "RETIRED";

export type CourtCardViewModel = {
  id: string;
  name: string;
  imageUrl?: string;
  logoUrl?: string;
  rating?: number;
  distanceText?: string;
  address?: string;
  area?: string;
  courtType?: string;
  capacity?: number;
  openTime?: string;
  closeTime?: string;
  startingPrice?: number;
  status: CourtStatus;
  tags: string[];
  hasPromotion?: boolean;
  isFavorite?: boolean;
};

export type CourtFilterState = {
  courtTypes: string[];
  statuses: CourtStatus[];
  areas: string[];
  priceRange: [number, number];
  timeSlots: string[];
  favoritesOnly: boolean;
};
