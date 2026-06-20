import { describe, it, expect } from "vitest";
import { trophyCutoffIndex } from "./trophyLine";

describe("trophyCutoffIndex", () => {
  it("returns the index of the last 9 in a points-desc list", () => {
    expect(trophyCutoffIndex([9, 9, 7, 6])).toBe(1);
  });
  it("returns the single 9 index", () => {
    expect(trophyCutoffIndex([9, 6, 3])).toBe(0);
  });
  it("returns -1 when no row has 9", () => {
    expect(trophyCutoffIndex([7, 6, 3])).toBe(-1);
  });
  it("returns -1 for an empty list", () => {
    expect(trophyCutoffIndex([])).toBe(-1);
  });
});
