const LAST_MOCK_SLOT_END_HOUR = 17;

export function toDateInputValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 10);
}

export function getDefaultAvailabilityDate(now = new Date()): string {
  const defaultDate = new Date(now);

  if (now.getHours() >= LAST_MOCK_SLOT_END_HOUR) {
    defaultDate.setDate(defaultDate.getDate() + 1);
  }

  return toDateInputValue(defaultDate);
}

export function dateFromIsoOrDefault(isoDate: string | null): string {
  if (!isoDate || Number.isNaN(Date.parse(isoDate))) {
    return getDefaultAvailabilityDate();
  }

  return toDateInputValue(new Date(isoDate));
}
