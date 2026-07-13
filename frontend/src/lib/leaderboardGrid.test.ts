import { describe, it, expect } from "vitest";
import { leaderboardGridTemplates } from "./leaderboardGrid";

describe("leaderboardGridTemplates", () => {
  it("season scope (all flags on) — desktop matches the pre-refactor template", () => {
    const { desktop } = leaderboardGridTemplates({ showAvg: true, showEvents: true, showCompAvg: true });
    expect(desktop).toBe("44px minmax(0, 1.6fr) 74px 70px 56px 96px 70px 78px 80px 24px");
  });

  it("cup / all-time scope (no comp avg) — desktop matches the pre-refactor template", () => {
    const { desktop } = leaderboardGridTemplates({ showAvg: true, showEvents: true, showCompAvg: false });
    expect(desktop).toBe("44px minmax(0, 1.6fr) 74px 70px 56px 96px 70px 78px 24px");
  });

  it("event / pod scope (no averages) — desktop matches the pre-refactor template", () => {
    const { desktop } = leaderboardGridTemplates({ showAvg: false, showEvents: false, showCompAvg: false });
    expect(desktop).toBe("44px minmax(0, 1.6fr) 70px 96px 70px 24px");
  });

  it("season scope — mobile keeps rank, player, trophies, pts, evts, best", () => {
    const { mobile } = leaderboardGridTemplates({ showAvg: true, showEvents: true, showCompAvg: true });
    expect(mobile).toBe("24px minmax(0, 1fr) 44px 40px 40px 40px");
  });

  it("cup / all-time scope — mobile keeps rank, player, trophies, pts, evts", () => {
    const { mobile } = leaderboardGridTemplates({ showAvg: true, showEvents: true, showCompAvg: false });
    expect(mobile).toBe("24px minmax(0, 1fr) 44px 40px 40px");
  });

  it("event / pod scope — mobile keeps rank, player, pts, W–L–D", () => {
    const { mobile } = leaderboardGridTemplates({ showAvg: false, showEvents: false, showCompAvg: false });
    expect(mobile).toBe("24px minmax(0, 1fr) 40px 70px");
  });
});
