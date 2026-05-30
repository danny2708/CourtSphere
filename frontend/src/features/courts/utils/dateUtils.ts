const LAST_MOCK_SLOT_END_HOUR = 17;
const vietnamDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric"
});

function getVietnamDateParts(date: Date): Record<string, string> {
  return Object.fromEntries(vietnamDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function toDateInputValue(date: Date): string {
  const parts = getVietnamDateParts(date);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getDefaultAvailabilityDate(now = new Date()): string {
  const parts = getVietnamDateParts(now);
  const defaultDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));

  if (Number(parts.hour) >= LAST_MOCK_SLOT_END_HOUR) {
    defaultDate.setUTCDate(defaultDate.getUTCDate() + 1);
  }

  return defaultDate.toISOString().slice(0, 10);
}

export function dateFromIsoOrDefault(isoDate: string | null): string {
  if (!isoDate || Number.isNaN(Date.parse(isoDate))) {
    return getDefaultAvailabilityDate();
  }

  return toDateInputValue(new Date(isoDate));
}
