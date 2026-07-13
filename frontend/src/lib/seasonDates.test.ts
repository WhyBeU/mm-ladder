import { describe, it, expect } from "vitest";
import { weeklyEventCount } from "./seasonDates";

describe("weeklyEventCount", () => {
  it("counts both endpoints as events (aligned weeks)", () => {
    // 2026-04-20 → 2026-07-31 is season 45's span → 15 weekly events.
    expect(weeklyEventCount("2026-04-20", "2026-07-31")).toBe(15);
  });

  it("returns 1 when start equals end", () => {
    expect(weeklyEventCount("2026-01-05", "2026-01-05")).toBe(1);
  });

  it("counts exact weeks inclusively", () => {
    expect(weeklyEventCount("2026-01-05", "2026-01-12")).toBe(2); // +7 days
    expect(weeklyEventCount("2026-01-05", "2026-02-02")).toBe(5); // +28 days
  });

  it("floors partial weeks (extra days don't add an event)", () => {
    expect(weeklyEventCount("2026-01-05", "2026-01-11")).toBe(1); // +6 days
    expect(weeklyEventCount("2026-01-05", "2026-01-18")).toBe(2); // +13 days
  });

  it("returns null for reversed ranges", () => {
    expect(weeklyEventCount("2026-07-31", "2026-04-20")).toBeNull();
  });

  it("returns null for missing or malformed dates", () => {
    expect(weeklyEventCount("", "2026-07-31")).toBeNull();
    expect(weeklyEventCount("2026-04-20", "")).toBeNull();
    expect(weeklyEventCount("2026-4-20", "2026-07-31")).toBeNull();
    expect(weeklyEventCount("not-a-date", "2026-07-31")).toBeNull();
  });
});
