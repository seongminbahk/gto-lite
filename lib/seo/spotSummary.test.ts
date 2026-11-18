import { describe, expect, it } from "vitest";
import { ALL_HANDS } from "@/lib/handRange/handList";
import { rangeStats } from "./spotSummary";
import { rangeCopy } from "./rangeCopy";

const range = (played: Record<string, number>, action: "raise" | "allin" = "raise") =>
  ALL_HANDS.map(({ hand }) => {
    const p = played[hand] ?? 0;
    return { hand, fold: 1 - p, call: 0, raise: action === "raise" ? p : 0, allin: action === "allin" ? p : 0 };
  });

describe("rangeStats", () => {
  it("shares by combos, the lowest hand played per row, and mixed hands", () => {
    const stats = rangeStats(range({ AA: 1, KK: 1, "55": 0.6, AKs: 1, A5s: 1, AKo: 0.3 }));
    expect(stats.playedCombos).toBeCloseTo(6 + 6 + 3.6 + 4 + 4 + 3.6);
    expect(stats.edges).toEqual([
      { category: "pairs", hand: "55" },
      { category: "suitedAces", hand: "A5s" },
    ]);
    expect(stats.mixedHands).toBe(2);
    expect(stats.pushFold).toBe(false);
  });

  it("all-in or fold is push/fold", () => {
    expect(rangeStats(range({ AA: 1 }, "allin")).pushFold).toBe(true);
  });
});

describe("range page copy", () => {
  const page = { format: "mtt", stackBb: 20, seat: "BTN", kind: "open" } as const;
  const stats = rangeStats(range({ AA: 1, "22": 1, A2s: 1 }));

  it("writes a different summary for different ranges", () => {
    const other = rangeStats(range({ AA: 1 }));
    expect(rangeCopy("en").summary(page, stats, "heuristic-approx")).not.toEqual(rangeCopy("en").summary(page, other, "heuristic-approx"));
    expect(rangeCopy("en").summary(page, stats, "heuristic-approx")[1]).toBe("It plays pairs down to 22 and suited aces down to A2s.");
  });

  it("names the seat, stack and format in both languages", () => {
    expect(rangeCopy("en").title(page, stats)).toBe("BTN Open Range at 20bb — MTT Preflop Chart");
    expect(rangeCopy("ko").title(page, stats)).toBe("20bb BTN 오픈 레인지 — 토너먼트 프리플랍 차트");
    const push = rangeStats(range({ AA: 1 }, "allin"));
    expect(rangeCopy("en").title({ ...page, stackBb: 10 }, push)).toBe("10bb BTN Push/Fold Chart — MTT");
  });
});
