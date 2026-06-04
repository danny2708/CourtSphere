const vietnamOffsetMinutes = 7 * 60;
const vietnamOffsetMs = vietnamOffsetMinutes * 60_000;

function vietnamDateParts(date: Date) {
  const shiftedDate = new Date(date.getTime() + vietnamOffsetMs);

  return {
    day: shiftedDate.getUTCDate(),
    month: shiftedDate.getUTCMonth(),
    weekday: shiftedDate.getUTCDay(),
    year: shiftedDate.getUTCFullYear()
  };
}

export function vietnamWallTimeToUtcDate(date: string, time = "00:00"): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  return new Date(Date.UTC(year, month - 1, day, hour, minute) - vietnamOffsetMs);
}

export function combineVietnamDateAndTime(date: Date, time: string): Date {
  const { day, month, year } = vietnamDateParts(date);
  const [hour, minute] = time.split(":").map(Number);

  return new Date(Date.UTC(year, month, day, hour, minute) - vietnamOffsetMs);
}

export function getVietnamIsoWeekday(date: Date): number {
  const { weekday } = vietnamDateParts(date);
  return weekday === 0 ? 7 : weekday;
}

export function startOfVietnamDay(date: Date): Date {
  const { day, month, year } = vietnamDateParts(date);
  return new Date(Date.UTC(year, month, day) - vietnamOffsetMs);
}

export function vietnamMinutesFromDate(date: Date): number {
  const shiftedDate = new Date(date.getTime() + vietnamOffsetMs);
  return shiftedDate.getUTCHours() * 60 + shiftedDate.getUTCMinutes();
}
