// ---------------------------------------------------------------------------
// Canonical date utilities — pure, UTC-safe, timezone-aware.
// Every module that needs "today" or date math should use these instead of
// hand-rolling new Date()/toLocaleDateString copies.
// ---------------------------------------------------------------------------

const DATE_STRING_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a Date as 'YYYY-MM-DD' resolved in the given IANA timezone.
 * en-CA locale yields ISO-style YYYY-MM-DD output.
 */
function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Current calendar date as 'YYYY-MM-DD', resolved in the given IANA
 * timezone (default 'UTC'). Invalid/unsupported timezones fall back to UTC.
 */
export function todayStr(timezone?: string): string {
  const now = new Date();
  if (timezone) {
    try {
      return formatDateInTimezone(now, timezone);
    } catch {
      // Invalid IANA timezone identifier — fall through to UTC.
    }
  }
  return formatDateInTimezone(now, "UTC");
}

/** True when `s` is a real calendar date in strict 'YYYY-MM-DD' form. */
export function isValidDateString(s: string): boolean {
  if (!DATE_STRING_REGEX.test(s)) return false;
  const [year = NaN, month = NaN, day = NaN] = s.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Shift a 'YYYY-MM-DD' date by N days using UTC-safe Date math and return
 * 'YYYY-MM-DD'. Throws RangeError on malformed input (wrong shape or a
 * non-existent calendar date such as '2026-02-30').
 */
export function shiftDate(dateStr: string, days: number): string {
  if (!isValidDateString(dateStr)) {
    throw new RangeError(
      `Invalid date string "${dateStr}" — expected a real calendar date in YYYY-MM-DD format`,
    );
  }
  const [year = 0, month = 0, day = 0] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
