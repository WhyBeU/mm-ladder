export interface DocEntry {
  slug: string;
  title: string;
}

// Order here drives the Docs section's table of contents.
export const DOCS: DocEntry[] = [
  { slug: "monday-night", title: "Run a Monday night" },
  { slug: "participants", title: "Fix participants & results" },
  { slug: "merge-players", title: "Merge vs. rename players" },
  { slug: "awards", title: "Champions, POTY & cup winners" },
  { slug: "new-season", title: "Start a new season + link a cup" },
  { slug: "pods-and-board", title: "Pod-maker & sign-up board" },
  { slug: "audit-log", title: "Read the audit log" },
];
