import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidDateString, shiftDate, todayStr } from "./date";

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// todayStr
// ---------------------------------------------------------------------------
describe("todayStr", () => {
  it("resolves the WIB calendar date across the UTC midnight boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T18:30:00Z")); // 01:30 WIB on Aug 24
    expect(todayStr("Asia/Jakarta")).toBe("2026-08-24");
    expect(todayStr("UTC")).toBe("2026-08-23");
  });

  it("defaults to UTC when no timezone is given", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T18:30:00Z"));
    expect(todayStr()).toBe("2026-08-23");
  });

  it("falls back to UTC for invalid timezones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T18:30:00Z"));
    expect(todayStr("Not/A_Real_Zone")).toBe("2026-08-23");
    expect(todayStr("")).toBe("2026-08-23");
  });

  it("handles positive and negative offsets far from UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T23:30:00Z"));
    expect(todayStr("Pacific/Kiritimati")).toBe("2027-01-01"); // UTC+14
    expect(todayStr("Pacific/Midway")).toBe("2026-12-31"); // UTC-11
  });

  it("returns the same day in WIB and UTC mid-day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T06:00:00Z")); // 13:00 WIB
    expect(todayStr("Asia/Jakarta")).toBe("2026-08-23");
    expect(todayStr("UTC")).toBe("2026-08-23");
  });
});

// ---------------------------------------------------------------------------
// shiftDate
// ---------------------------------------------------------------------------
describe("shiftDate", () => {
  it("shifts within a month", () => {
    expect(shiftDate("2026-08-23", 1)).toBe("2026-08-24");
    expect(shiftDate("2026-08-23", -1)).toBe("2026-08-22");
    expect(shiftDate("2026-08-23", 0)).toBe("2026-08-23");
  });

  it("shifts across month boundaries", () => {
    expect(shiftDate("2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2026-04-30", 1)).toBe("2026-05-01");
    expect(shiftDate("2026-12-01", -1)).toBe("2026-11-30");
  });

  it("handles leap years", () => {
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDate("2028-02-29", 1)).toBe("2028-03-01");
    expect(shiftDate("2026-02-28", 1)).toBe("2026-03-01"); // non-leap
  });

  it("shifts across year boundaries", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("is independent of the host machine timezone (UTC-safe)", () => {
    // Constructed purely with Date.UTC + UTC getters, so the result must not
    // drift no matter which TZ the runner executes in.
    expect(shiftDate("2026-01-01", 365)).toBe("2027-01-01");
  });

  it("throws RangeError on malformed input", () => {
    expect(() => shiftDate("next Tuesday", 1)).toThrow(RangeError);
    expect(() => shiftDate("", 1)).toThrow(RangeError);
    expect(() => shiftDate("2026-8-23", 1)).toThrow(RangeError);
    expect(() => shiftDate("2026/08/23", 1)).toThrow(RangeError);
  });

  it("throws RangeError on well-shaped but non-existent dates", () => {
    expect(() => shiftDate("2026-02-30", 1)).toThrow(RangeError);
    expect(() => shiftDate("2026-13-01", 1)).toThrow(RangeError);
    expect(() => shiftDate("2026-00-10", 1)).toThrow(RangeError);
    expect(() => shiftDate("2026-04-31", 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// isValidDateString
// ---------------------------------------------------------------------------
describe("isValidDateString", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDateString("2026-08-23")).toBe(true);
    expect(isValidDateString("2028-02-29")).toBe(true); // leap day
    expect(isValidDateString("2000-01-01")).toBe(true);
  });

  it("rejects malformed shapes", () => {
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString("next Tuesday")).toBe(false);
    expect(isValidDateString("2026-8-23")).toBe(false);
    expect(isValidDateString("2026/08/23")).toBe(false);
    expect(isValidDateString("2026-08-23T00:00:00Z")).toBe(false);
  });

  it("rejects well-shaped but impossible dates", () => {
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-00-10")).toBe(false);
    expect(isValidDateString("2025-02-29")).toBe(false); // non-leap year
  });
});
