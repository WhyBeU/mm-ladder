import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DOCS } from "./docsRegistry";

describe("docs registry", () => {
  it("every registered slug has a matching markdown file", () => {
    for (const { slug } of DOCS) {
      const path = join(process.cwd(), "public", "docs", `${slug}.md`);
      expect(existsSync(path), `missing public/docs/${slug}.md`).toBe(true);
    }
  });
  it("slugs are unique", () => {
    const slugs = DOCS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
