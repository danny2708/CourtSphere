import type { AvailabilitySlotViewModel } from "../../courts/types/availability.types";

const storageKeyPrefix = "courtsphere.booking.selection.";

export type StoredBookingSelection = {
  id: string;
  courtId: string;
  createdAt: string;
  slots: AvailabilitySlotViewModel[];
};

export function saveBookingSelection(courtId: string, slots: AvailabilitySlotViewModel[]): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const selection: StoredBookingSelection = {
    id,
    courtId,
    createdAt: new Date().toISOString(),
    slots
  };

  window.sessionStorage.setItem(`${storageKeyPrefix}${id}`, JSON.stringify(selection));

  return id;
}

export function readBookingSelection(id: string | null): StoredBookingSelection | null {
  if (!id) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(`${storageKeyPrefix}${id}`);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredBookingSelection;
    return Array.isArray(parsed.slots) && typeof parsed.courtId === "string" ? parsed : null;
  } catch {
    return null;
  }
}
