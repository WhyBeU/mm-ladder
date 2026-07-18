// Shared community links + recurring-event details, used by the promo banner and footer.

export const DISCORD_URL = "https://discord.gg/bSEJEY2Vs";

/** The weekly draft night. */
export const WEEKLY_DRAFT = {
  day: "Monday",
  time: "6:30pm",
  venue: "Chromatic Games (Ashfield)",
} as const;

/** e.g. "Monday 6:30pm @ Chromatic Games (Ashfield)" */
export const WEEKLY_DRAFT_LINE = `${WEEKLY_DRAFT.day} ${WEEKLY_DRAFT.time} @ ${WEEKLY_DRAFT.venue}`;
