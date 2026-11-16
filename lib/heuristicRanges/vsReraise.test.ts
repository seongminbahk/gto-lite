import { describe, expect, it } from "vitest";
import { computePlayabilityRanking } from "@/lib/equity/handStrength";
import { loadEquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { ALL_HANDS, HAND_BY_LABEL, TOTAL_COMBOS } from "@/lib/handRange/handList";
import type { FrequencyMap } from "@/lib/nashSolver/pushFoldSolver";
import { NO_RAKE } from "@/lib/solveEngine/rake";
import type { HandFrequency } from "@/types/rangeData";
import { generateCallShoveScenario, generateVsReraiseScenario, type VsReraiseParams } from "./vsReraise";

const matrix = loadEquityMatrix();
const ranking = computePlayabilityRanking(matrix);
const range = (hands: string): FrequencyMap => new Map(hands.split(" ").map((hand) => [hand, 1]));
const combosOf = (map: FrequencyMap) => [...map].reduce((sum, [hand, freq]) => sum + freq * HAND_BY_LABEL.get(hand)!.combos, 0);

const OPENER = "AA KK QQ JJ TT 99 88 77 66 55 AKs AQs AJs ATs A9s A5s KQs KJs KTs QJs QTs JTs T9s 98s 87s AKo AQo AJo ATo KQo KJo QJo";
const WIDE_THREE_BET = "AA KK QQ JJ TT 99 AKs AQs AJs ATs KQs KJs AKo AQo AJo A5s A4s A3s 76s 65s 54s";
const TIGHT_THREE_BET = "AA KK QQ AKs AKo A5s";

const base: VsReraiseParams = {
  heroRange: range(OPENER),
  villainRange: range(WIDE_THREE_BET),
  isIP: true,
  potBb: 13,
  amountOwedBb: 7.5,
  raiseWidth: 0.04,
  bluffWidth: 0,
  keepBase: 0.5,
  rake: NO_RAKE,
};
const continuing = (hands: HandFrequency[]) => hands.reduce((sum, h) => sum + (1 - h.fold) * HAND_BY_LABEL.get(h.hand)!.combos, 0);
const solve = (overrides: Partial<VsReraiseParams> = {}) => generateVsReraiseScenario(matrix, ranking, { ...base, ...overrides });

describe("generateVsReraiseScenario", () => {
  it("gives every hand frequencies that sum to 1", () => {
    const hands = solve();
    expect(hands).toHaveLength(ALL_HANDS.length);
    for (const h of hands) {
      expect(h.fold + h.call + h.raise).toBeCloseTo(1, 9);
      expect(Math.min(h.fold, h.call, h.raise)).toBeGreaterThanOrEqual(0);
    }
  });

  it("folds whatever was never in the range", () => {
    const hands = new Map(solve().map((h) => [h.hand, h]));
    expect(hands.get("72o")!.fold).toBe(1);
    expect(hands.get("A2s")!.fold).toBe(1);
  });

  it("continues only with part of the range, and with its best hands", () => {
    const hands = new Map(solve().map((h) => [h.hand, h]));
    const width = continuing([...hands.values()]);
    expect(width).toBeLessThan(combosOf(base.heroRange));
    expect(hands.get("AA")!.fold).toBe(0);
    expect(hands.get("QJo")!.fold).toBeGreaterThan(hands.get("AKs")!.fold);
  });

  it("counts a value re-raise as all of a hand's combos when asked, so a mixed range re-raises only its best hands", () => {
    const mixed: FrequencyMap = new Map([...range(OPENER)].map(([hand]) => [hand, 0.3]));
    const raisedHands = (hands: HandFrequency[]) => hands.filter((h) => h.raise > 0).map((h) => h.hand);
    const byReach = raisedHands(solve({ heroRange: mixed }));
    const byDeck = raisedHands(solve({ heroRange: mixed, valueInDeckCombos: true }));
    expect(byDeck.length).toBeLessThan(byReach.length);
    expect(byDeck).toContain("AA");
    // A range that has all of its best hands is unaffected.
    expect(solve({ valueInDeckCombos: true })).toEqual(solve());
  });

  it("re-raises for value the hands with the most equity against the raiser, not the most playable", () => {
    // Room for AA, KK, QQ and one more hand: AKs by equity against these, where playability would pick JJ.
    const hands = new Map(solve({ villainRange: range(TIGHT_THREE_BET), raiseWidth: 22 / TOTAL_COMBOS }).map((h) => [h.hand, h]));
    expect(hands.get("AKs")!.raise).toBeCloseTo(1, 9);
    expect(hands.get("JJ")!.raise).toBe(0);
    expect(hands.get("JJ")!.fold).toBeLessThan(1);
  });

  it("re-raises its best hands up to the requested width", () => {
    const hands = solve();
    const raised = hands.reduce((sum, h) => sum + h.raise * HAND_BY_LABEL.get(h.hand)!.combos, 0);
    expect(raised / TOTAL_COMBOS).toBeCloseTo(0.04, 3);
    expect(new Map(hands.map((h) => [h.hand, h])).get("AA")!.raise).toBe(1);
  });

  it("keeps playable hands over ones that only have all-in equity", () => {
    const hands = new Map(solve({ heroRange: range("AA KK AKs 76s K4o") }).map((h) => [h.hand, h]));
    expect(ranking.get("76s")!).toBeLessThan(ranking.get("K4o")!);
    expect(hands.get("76s")!.fold).toBeLessThan(hands.get("K4o")!.fold);
  });

  it("bluffs only with suited candidates it would otherwise fold", () => {
    const plain = new Map(solve().map((h) => [h.hand, h]));
    const bluffed = solve({ heroRange: range(`${OPENER} A4s A3s A2s 65s 54s`), bluffWidth: 0.01 });
    const raisedMore = bluffed.filter((h) => h.raise > (plain.get(h.hand)?.raise ?? 0) + 1e-9);
    expect(raisedMore.length).toBeGreaterThan(0);
    for (const h of raisedMore) expect(HAND_BY_LABEL.get(h.hand)!.type).toBe("suited");
    const bluffCombos = bluffed.reduce((sum, h) => sum + (h.raise - (plain.get(h.hand)?.raise ?? 0)) * HAND_BY_LABEL.get(h.hand)!.combos, 0);
    expect(bluffCombos).toBeGreaterThan(0);
  });

  it("is unchanged without bluffs", () => {
    expect(solve({ bluffWidth: 0 })).toEqual(solve());
  });

  it("gives up more against a tighter raiser", () => {
    expect(continuing(solve({ villainRange: range(TIGHT_THREE_BET) }))).toBeLessThan(continuing(solve()));
  });

  it("gives up more at a worse price", () => {
    expect(continuing(solve({ amountOwedBb: 12 }))).toBeLessThan(continuing(solve()));
  });

  it("gives up more out of position", () => {
    expect(continuing(solve({ isIP: false }))).toBeLessThan(continuing(solve()));
  });

  it("gives up more under rake", () => {
    expect(continuing(solve({ rake: { rate: 0.1, capBb: 3 } }))).toBeLessThan(continuing(solve()));
  });
});

describe("generateCallShoveScenario", () => {
  const shove = { heroRange: range(OPENER), villainRange: range(WIDE_THREE_BET), potBb: 136, amountOwedBb: 66, rake: NO_RAKE };
  const calling = (overrides = {}) => continuing(generateCallShoveScenario(matrix, { ...shove, ...overrides }));

  it("calls wider the more dead money is in the pot", () => {
    expect(calling()).toBeGreaterThan(calling({ potBb: 70 }));
  });

  it("never calls from outside the range, and never raises", () => {
    const hands = generateCallShoveScenario(matrix, shove);
    expect(hands.find((h) => h.hand === "72o")!.fold).toBe(1);
    expect(hands.every((h) => h.raise === 0)).toBe(true);
    expect(hands.find((h) => h.hand === "AA")!.call).toBe(1);
  });

  it("calls tighter under rake", () => {
    expect(calling({ potBb: 90, rake: { rate: 0.1, capBb: 30 } })).toBeLessThan(calling({ potBb: 90 }));
  });

  it("against a raise that isn't all-in, moves its best continues all-in and calls with the rest", () => {
    const plain = generateCallShoveScenario(matrix, shove);
    const hands = generateCallShoveScenario(matrix, { ...shove, jamShareOfContinues: 0.7 });
    const combos = (pick: (h: HandFrequency) => number) => hands.reduce((sum, h) => sum + pick(h) * HAND_BY_LABEL.get(h.hand)!.combos, 0);
    // The same hands continue; 70% of them by combos jam, the strongest first.
    expect(continuing(hands)).toBeCloseTo(continuing(plain), 9);
    expect(combos((h) => h.allin ?? 0) / combos((h) => 1 - h.fold)).toBeCloseTo(0.7, 6);
    expect(hands.find((h) => h.hand === "AA")).toMatchObject({ allin: 1, call: 0 });
    expect(hands.every((h) => h.raise === 0)).toBe(true);
  });

  it("with a jam defense, calls more of its range until the folding hands can't jam at a profit", () => {
    // A tight value range against a tight jam, where the hands that would have folded get to jam instead.
    const tight = { heroRange: range("AA KK QQ JJ TT AKs AKo AQs"), villainRange: range("AA KK"), potBb: 120, amountOwedBb: 84, rake: NO_RAKE };
    const folding = range("72o 83o 94o J5o T4o 62s 53o Q3o K2o 95s");
    const jamDefense = { foldingRange: folding, villainRiskBb: 96 };
    const plain = continuing(generateCallShoveScenario(matrix, tight));
    const defended = generateCallShoveScenario(matrix, { ...tight, jamDefense });
    expect(continuing(defended)).toBeGreaterThan(plain);
    expect(defended.find((h) => h.hand === "72o")!.fold).toBe(1);
    // No defense is needed when the jams already lose: a pot with nothing to win.
    expect(continuing(generateCallShoveScenario(matrix, { ...tight, potBb: 96.5, jamDefense: { ...jamDefense, villainRiskBb: 96 } }))).toBeGreaterThanOrEqual(plain);
  });
});

describe("generateVsReraiseScenario minValueEquity", () => {
  it("re-raises for value only hands ahead of the raiser by that much", () => {
    const weak = solve({ heroRange: range("A4o A3o K8o Q2s J5s 76s"), villainRange: range(OPENER), raiseWidth: 0.02, minValueEquity: 0.5 });
    expect(weak.every((h) => h.raise === 0)).toBe(true);
    const strong = solve({ heroRange: range("AA KK A4o"), villainRange: range(OPENER), raiseWidth: 0.02, minValueEquity: 0.5 });
    expect(strong.find((h) => h.hand === "AA")!.raise).toBeGreaterThan(0);
  });

  it("mixes value re-raises and calls across the edge of the value range when asked", () => {
    const hard = solve();
    const soft = solve({ valueMixSpread: 0.3 });
    const raised = (hands: HandFrequency[]) => hands.reduce((sum, h) => sum + h.raise * HAND_BY_LABEL.get(h.hand)!.combos, 0);
    expect(hard.every((h) => h.raise === 0 || h.raise === 1 || h.raise === Math.min(1, h.raise))).toBe(true);
    expect(soft.filter((h) => h.raise > 0.05 && h.raise < 0.95).length).toBeGreaterThan(hard.filter((h) => h.raise > 0.05 && h.raise < 0.95).length);
    // About as many combos re-raise either way, and the best hand still always does.
    expect(Math.abs(raised(soft) - raised(hard))).toBeLessThan(0.25 * raised(hard));
    expect(soft.find((h) => h.hand === "AA")!.raise).toBe(1);
  });

  it("bluffs with suited aces and kings, part of each, including hands that would call", () => {
    const hands = solve({ bluffWidth: 0.01, blockerBluffMaxShare: 0.5 });
    const value = new Set(solve().filter((h) => h.raise > 0).map((h) => h.hand));
    const bluffs = hands.filter((h) => h.raise > 0 && !value.has(h.hand));
    expect(bluffs.length).toBeGreaterThan(0);
    for (const h of bluffs) {
      expect(h.hand).toMatch(/^[AK].s$/);
      expect(h.raise).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(h.fold + h.call + h.raise).toBeCloseTo(1, 9);
    }
    // A wheel ace, which blocks aces and makes straights, goes first.
    expect(hands.find((h) => h.hand === "A5s")!.raise).toBeGreaterThan(0);
  });
});
