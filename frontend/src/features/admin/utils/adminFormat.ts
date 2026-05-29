export const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency"
});

export const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function formatMoney(value: number | null | undefined): string {
  return moneyFormatter.format(value ?? 0);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Chưa có";
  }

  return dateTimeFormatter.format(new Date(value));
}

export function stringifyCompact(value: unknown): string {
  if (value === null || value === undefined) {
    return "Không có dữ liệu";
  }

  return JSON.stringify(value, null, 2);
}
