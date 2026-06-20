import { describe, it, expect } from "vitest";
import { chunk } from "./awardsLayout";

describe("chunk", () => {
  it("splits into rows of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
  });
  it("returns one row when under the size", () => {
    expect(chunk([1, 2, 3], 4)).toEqual([[1, 2, 3]]);
  });
  it("returns an empty array for no items", () => {
    expect(chunk([], 4)).toEqual([]);
  });
  it("handles an exact multiple", () => {
    expect(chunk([1, 2, 3, 4], 4)).toEqual([[1, 2, 3, 4]]);
  });
});
