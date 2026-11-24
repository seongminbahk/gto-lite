import { describe, expect, it } from "vitest";
import { NOTES } from "@/lib/explain/knowledge/notes";
import { parseSpotParams } from "./spotPages";
import { conceptGroups } from "./learnContent";
import { parseFlopParams } from "./flopPages";
import { FLOP_DATA } from "./flopData";

describe("learn page", () => {
  const concepts = conceptGroups().flatMap((g) => g.concepts);

  it("shows every concept note once, with a title in both languages", () => {
    expect(concepts.map((c) => c.id).sort()).toEqual(NOTES.map((n) => n.id).sort());
    for (const c of concepts) {
      expect(c.title.en).not.toBe(c.id);
      expect(c.title.ko).not.toBe(c.id);
    }
  });

  it("links only to range and flop pages that exist", () => {
    for (const link of concepts.flatMap((c) => c.links)) {
      const [, kind, format, a, b] = link.path.split("/");
      if (kind === "flops") expect(parseFlopParams(FLOP_DATA, { spot: a, board: b }), link.path).not.toBeNull();
      else expect(parseSpotParams({ format, stack: a, spot: b }), link.path).not.toBeNull();
    }
  });
});
