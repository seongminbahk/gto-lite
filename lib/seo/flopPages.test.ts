import { describe, expect, it } from "vitest";
import { STRENGTH_BUCKETS } from "@/lib/explain/handStrength";
import { decodeSpot } from "@/lib/share/spotLink";
import { allFlopPages, boardSlug, FLOP_BOARDS, FLOP_SPOTS, flopPath, parseFlopParams } from "./flopPages";
import { FLOP_DATA } from "./flopData";
import { flopCopy } from "./flopCopy";

describe("flop pages", () => {
  it("names boards by ranks and suits, each once", () => {
    expect(boardSlug(["Kh", "7d", "2c"])).toBe("k72-rainbow");
    expect(boardSlug(["9h", "8h", "6d"])).toBe("986-two-tone");
    expect(boardSlug(["Ah", "9h", "4h"])).toBe("a94-monotone");
    expect(new Set(FLOP_BOARDS.map((b) => b.slug)).size).toBe(FLOP_BOARDS.length);
  });

  it("has every spot and board solved, and each reads back from its address", () => {
    const pages = allFlopPages(FLOP_DATA);
    expect(pages).toHaveLength(FLOP_SPOTS.length * FLOP_BOARDS.length);
    for (const page of pages) {
      const [, , , spot, board] = flopPath(page).split("/");
      expect(parseFlopParams(FLOP_DATA, { spot, board })).toEqual(page);
    }
    expect(parseFlopParams(FLOP_DATA, { spot: "btn-vs-bb", board: "k72-monotone" })).toBeNull();
  });

  it("stores shares that add up, over the actions and over the hand groups", () => {
    for (const spot of Object.values(FLOP_DATA.spots))
      for (const d of Object.values(spot))
        for (const node of [d.root, d.afterCheck, ...(d.facingBet ? [d.facingBet] : [])]) {
          expect(node.actions.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 2);
          expect(STRENGTH_BUCKETS.reduce((s, b) => s + node.buckets[b].share, 0)).toBeCloseTo(1, 2);
        }
  });

  it("the preflop line leads to the flop the page names", () => {
    for (const spot of FLOP_SPOTS) {
      const last = spot.preflop.at(-1)!;
      expect(last.action).toBe("call");
      expect(spot.preflop.filter((s) => s.action === "raise")).toHaveLength(spot.threeBet ? 2 : 1);
    }
    expect(decodeSpot("").path).toEqual([]);
  });

  it("writes the summary from the numbers, in both languages", () => {
    const page = allFlopPages(FLOP_DATA).find((p) => p.board.slug === "k72-rainbow" && p.spot.slug === "btn-vs-bb")!;
    const d = FLOP_DATA.spots["btn-vs-bb"]["k72-rainbow"];
    expect(flopCopy("en").heading(page)).toBe("K72 rainbow flop (Ks 7d 2c): BTN vs BB single-raised pot");
    expect(flopCopy("ko").title(page)).toBe("K72 레인보우 플랍 전략 — BTN vs BB 싱글 레이즈 팟, 홀덤 100bb 캐시");
    expect(flopCopy("en").summary(page, d)[0]).toMatch(/^On Ks 7d 2c the BB is first to act\. It checks \d/);
  });
});
