import { describe, expect, it } from "vitest";
import { draftMonday, formatDraftDate } from "./draftDate";

const iso = (d: Date | null) => d?.toISOString().slice(0, 10);

describe("draftMonday", () => {
  it("rolls a mid-week action forward to the next Monday", () => {
    // Wed 26 Nov 2026, 10:00 Sydney (AEDT, UTC+11)
    expect(iso(draftMonday("2026-11-25T23:00:00Z"))).toBe("2026-11-30");
  });

  it("keeps a Monday action on that same Monday", () => {
    // Mon 30 Nov 2026, 19:30 Sydney
    expect(iso(draftMonday("2026-11-30T08:30:00Z"))).toBe("2026-11-30");
  });

  it("keeps the current Monday from midnight to 23:59 Sydney", () => {
    // Mon 30 Nov 2026 00:00 and 23:59 Sydney (AEDT, UTC+11)
    expect(iso(draftMonday(new Date("2026-11-29T13:00:00Z")))).toBe("2026-11-30");
    expect(iso(draftMonday(new Date("2026-11-30T12:59:00Z")))).toBe("2026-11-30");
  });

  it("rolls a Tuesday action to the following Monday", () => {
    // Tue 1 Dec 2026, 08:00 Sydney
    expect(iso(draftMonday("2026-11-30T21:00:00Z"))).toBe("2026-12-07");
  });

  it("uses Sydney's calendar day, not UTC's", () => {
    // Sunday 23:00 UTC is already Monday 10:00 in Sydney
    expect(iso(draftMonday("2026-11-29T23:00:00Z"))).toBe("2026-11-30");
  });

  it("returns null for an unparseable timestamp", () => {
    expect(draftMonday("not a date")).toBeNull();
  });
});

describe("formatDraftDate", () => {
  it("formats as day and month", () => {
    expect(formatDraftDate(new Date("2026-12-07T00:00:00Z"))).toBe("7 December");
  });
});
