import { describe, expect, it } from "vitest";
import { allSpotPages, otherSeats, otherStacks, parseSpotParams, spotParams, spotPath } from "./spotPages";
import { solveSpotPage } from "./spotSolve";
import { rangeStats } from "./spotSummary";
import { decodeSpot } from "@/lib/share/spotLink";

describe("range spot pages", () => {
  const pages = allSpotPages();

  it("covers 7 tournament seats at 8 stacks and 5 cash 6-max seats at 100bb", () => {
    expect(pages).toHaveLength(7 * 8 + 5);
    expect(new Set(pages.map(spotPath)).size).toBe(pages.length);
    expect(spotPath({ format: "mtt", stackBb: 20, seat: "BTN", kind: "open" })).toBe("/ranges/mtt/20bb/btn-open");
    expect(spotPath({ format: "cash-6max", stackBb: 100, seat: "CO", kind: "open" })).toBe("/ranges/cash-6max/100bb/co-open");
  });

  it("every slug reads back as its page", () => {
    for (const page of pages) expect(parseSpotParams(spotParams(page))).toEqual(page);
  });

  it("refuses addresses no page answers", () => {
    expect(parseSpotParams({ format: "mtt", stack: "12bb", spot: "btn-open" })).toBeNull();
    expect(parseSpotParams({ format: "mtt", stack: "020bb", spot: "btn-open" })).toBeNull();
    expect(parseSpotParams({ format: "cash-6max", stack: "100bb", spot: "utg-open" })).toBeNull();
    expect(parseSpotParams({ format: "mtt", stack: "20bb", spot: "bb-open" })).toBeNull();
    expect(parseSpotParams({ format: "cash-9max", stack: "100bb", spot: "btn-open" })).toBeNull();
  });

  it("links the same seat at other stacks and other seats at the same stack", () => {
    const page = { format: "mtt", stackBb: 20, seat: "BTN", kind: "open" } as const;
    expect(otherStacks(page).map((p) => p.stackBb)).toEqual([10, 15, 25, 30, 40, 60, 100]);
    expect(otherSeats(page).map((p) => p.seat)).toEqual(["UTG", "UTG1", "LJ", "HJ", "CO", "SB"]);
  });

  it("solves every spot with the seat first to act, and links the solver to that same spot", () => {
    for (const page of pages) {
      const solved = solveSpotPage(page);
      expect(solved.hands).toHaveLength(169);
      expect(solved.path.every((step) => step.action === "fold")).toBe(true);
      const spot = decodeSpot(solved.solverQuery);
      expect(spot.settings.stackBb).toBe(page.stackBb);
      expect(spot.path).toEqual(solved.path);
      expect(rangeStats(solved.hands).share.fold).toBeLessThan(1);
    }
  });

  it("short tournament stacks are push/fold Nash ranges", () => {
    const solved = solveSpotPage({ format: "mtt", stackBb: 10, seat: "BTN", kind: "open" });
    expect(solved.source).toBe("nash-shove-fold");
    expect(rangeStats(solved.hands).pushFold).toBe(true);
  });
});
