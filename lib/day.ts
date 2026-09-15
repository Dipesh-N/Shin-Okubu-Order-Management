/** The restaurant's own day, not the server's. Japan has no daylight saving. */
const TIMEZONE = "Asia/Tokyo";
const UTC_OFFSET_HOURS = 9;

/** Today in the restaurant's timezone, as "YYYY-MM-DD". */
export function todayInTokyo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "YYYY-MM-DD" -> the UTC instants that bracket that local day. */
export function tokyoDayRange(date: string): { start: Date; end: Date } {
  const [y, m, d] = date.split("-").map(Number);
  // Date.UTC rolls over month and year boundaries on its own.
  return {
    start: new Date(Date.UTC(y, m - 1, d, -UTC_OFFSET_HOURS)),
    end: new Date(Date.UTC(y, m - 1, d + 1, -UTC_OFFSET_HOURS)),
  };
}

/** Shifts a "YYYY-MM-DD" by whole days, for the ‹ › buttons. */
export function shiftDay(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

export function isValidDay(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** "Tuesday, 15 September" for the heading. */
export function formatDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
