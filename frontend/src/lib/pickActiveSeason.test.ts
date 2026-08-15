import { describe, it, expect } from "vitest";
import { pickActiveSeason } from "./seasonDates";
import type { Season } from "@/lib/types";

function season(over: Partial<Season> & Pick<Season, "id" | "set_code" | "starts_on" | "ends_on">): Season {
  return {
    name: over.set_code,
    keyrune: over.set_code.toLowerCase(),
    yearly_cup_id: 12,
    qualifier_count: 0,
    event_count: 10,
    comp_avg_n: 7,
    qualifying_type: "POINTS",
    champion_player_id: null,
    is_current: false,
    ...over,
  };
}

// The real overlap that started this: Cube 2027 runs a full year underneath the set seasons.
const CUBE = season({ id: 48, set_code: "C27", starts_on: "2026-08-03", ends_on: "2027-09-26" });
const HOBBIT = season({ id: 49, set_code: "HOB", starts_on: "2026-08-10", ends_on: "2026-09-27" });
const FRACTURE = season({
  id: 50,
  set_code: "FRA",
  starts_on: "2026-09-28",
  ends_on: "2026-11-27",
  qualifier_count: 2,
});
const STAR_TREK = season({ id: 51, set_code: "TRK", starts_on: "2026-11-09", ends_on: "2026-12-31" });

describe("pickActiveSeason", () => {
  it("takes the latest-started season covering today, not the longest-running one", () => {
    expect(pickActiveSeason([CUBE, HOBBIT], "2026-08-15")?.set_code).toBe("HOB");
  });

  it("hands the ladder over the day a new season starts", () => {
    expect(pickActiveSeason([CUBE, HOBBIT], "2026-08-09")?.set_code).toBe("C27");
    expect(pickActiveSeason([CUBE, HOBBIT], "2026-08-10")?.set_code).toBe("HOB");
  });

  it("prefers a qualifying season over one that started later", () => {
    expect(pickActiveSeason([CUBE, FRACTURE, STAR_TREK], "2026-11-15")?.set_code).toBe("FRA");
  });

  it("falls back to the latest-started once the qualifying season has ended", () => {
    expect(pickActiveSeason([CUBE, FRACTURE, STAR_TREK], "2026-11-28")?.set_code).toBe("TRK");
  });

  it("ignores seasons that have not started or have ended", () => {
    expect(pickActiveSeason([HOBBIT, FRACTURE], "2026-09-27")?.set_code).toBe("HOB");
    expect(pickActiveSeason([HOBBIT, FRACTURE], "2026-09-28")?.set_code).toBe("FRA");
  });

  it("falls back to the most recently ended season between seasons", () => {
    expect(pickActiveSeason([HOBBIT, FRACTURE], "2026-12-25")?.set_code).toBe("FRA");
    expect(pickActiveSeason([HOBBIT, FRACTURE], "2026-01-01")?.set_code).toBe("FRA");
  });

  it("returns null for an empty list", () => {
    expect(pickActiveSeason([], "2026-08-15")).toBeNull();
  });
});
