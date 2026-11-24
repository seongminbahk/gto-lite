import { describe, expect, it } from "vitest";
import { allSpotPages, openSpotPages, otherSeats, otherStacks, parseSpotParams, relatedSpots, spotParams, spotPath, vsOpenSpotPages } from "./spotPages";
import { solveSpotPage } from "./spotSolve";
import { rangeStats } from "./spotSummary";
import { decodeSpot } from "@/lib/share/spotLink";

describe("range spot pages", () => {
  const pages = openSpotPages();

  it("covers 7 tournament seats at 8 stacks, push/fold at 10 and 12bb on the bubble and at the final table, and 5 cash 6-max seats at 100bb", () => {
    expect(pages).toHaveLength(7 * 8 + 2 * 7 * 2 + 5);
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
  }, 60_000);

  it("solves the bubble under ICM: the big blind defends tighter than at chip EV", () => {
    const page = { stackBb: 20, seat: "BB", kind: "vs-open", opener: "CO" } as const;
    const defend = (format: "mtt" | "mtt-bubble") => 1 - rangeStats(solveSpotPage({ ...page, format }).hands).share.fold;
    expect(defend("mtt-bubble")).toBeLessThan(defend("mtt") - 0.03);
    expect(decodeSpot(solveSpotPage({ ...page, format: "mtt-bubble" }).solverQuery).settings.icm.id).toBe("bubble");
  });

  it("short tournament stacks are push/fold Nash ranges", () => {
    const solved = solveSpotPage({ format: "mtt", stackBb: 10, seat: "BTN", kind: "open" });
    expect(solved.source).toBe("nash-shove-fold");
    expect(rangeStats(solved.hands).pushFold).toBe(true);
  });
});

describe("facing-an-open pages", () => {
  const pages = vsOpenSpotPages();

  it("covers every cash pairing and the tournament button and blinds at 4 stacks", () => {
    // Cash: 5 + 4 + 3 + 2 + 1 pairings. MTT: BTN vs 5 openers, SB vs 6, BB vs 7, at 4 stacks.
    expect(pages.filter((p) => p.format === "cash-6max")).toHaveLength(15);
    expect(pages.filter((p) => p.format === "mtt")).toHaveLength((5 + 6 + 7) * 4);
    expect(pages.filter((p) => p.format === "mtt-bubble")).toHaveLength(7 * 2);
    expect(spotPath({ format: "cash-6max", stackBb: 100, seat: "BB", kind: "vs-open", opener: "BTN" })).toBe("/ranges/cash-6max/100bb/bb-vs-btn-open");
    for (const page of pages) expect(parseSpotParams(spotParams(page))).toEqual(page);
    expect(parseSpotParams({ format: "cash-6max", stack: "100bb", spot: "co-vs-btn-open" })).toBeNull();
    expect(parseSpotParams({ format: "mtt", stack: "10bb", spot: "bb-vs-btn-open" })).toBeNull();
    expect(new Set(allSpotPages().map(spotPath)).size).toBe(allSpotPages().length);
  });

  it("solves the seat facing the open, and links the solver to that spot", () => {
    for (const page of pages) {
      const solved = solveSpotPage(page);
      expect(solved.path.filter((s) => s.action === "raise")).toEqual([{ actor: page.opener, action: "raise" }]);
      expect(solved.openToBb).toBeGreaterThan(1);
      expect(decodeSpot(solved.solverQuery).path).toEqual(solved.path);
      const stats = rangeStats(solved.hands);
      expect(stats.share.fold).toBeGreaterThan(0.1);
      expect(stats.share.fold).toBeLessThan(1);
    }
  }, 60_000);

  it("the BB defends wider against a button open than against an early one", () => {
    const defend = (opener: "LJ" | "BTN") => 1 - rangeStats(solveSpotPage({ format: "cash-6max", stackBb: 100, seat: "BB", kind: "vs-open", opener }).hands).share.fold;
    expect(defend("BTN")).toBeGreaterThan(defend("LJ"));
  });

  it("links an open to the seats that defend against it, and back", () => {
    const open = { format: "cash-6max", stackBb: 100, seat: "CO", kind: "open" } as const;
    expect(relatedSpots(open).map((p) => p.seat)).toEqual(["BTN", "SB", "BB"]);
    expect(relatedSpots(relatedSpots(open)[0])).toEqual([open]);
    expect(otherSeats({ format: "cash-6max", stackBb: 100, seat: "BTN", kind: "vs-open", opener: "CO" }).map((p) => p.opener)).toEqual(["LJ", "HJ"]);
  });
});
