import { describe, expect, it } from "vitest";
import { SAMPLE_SUMMARY } from "../explainTestUtils";
import type { HandSummary, PostflopDecisionSummary } from "../summarySchema";
import { boardTags, extractFeatures } from "./features";

const decision = (seat: "BB" | "BTN", taken: string, potBb: number, toCallBb = 0): PostflopDecisionSummary => ({
  seat,
  potBb,
  toCallBb,
  options: [taken],
  taken,
  combos: 500,
  mix: [100],
  byBucket: [],
});

function withFlop(decisions: PostflopDecisionSummary[], board = ["Kh", "7s", "2d"]): HandSummary {
  return { ...SAMPLE_SUMMARY, streets: [{ ...SAMPLE_SUMMARY.streets[0], board, decisions }] };
}

describe("extractFeatures", () => {
  it("reads the sample: a single-raised tournament pot, BTN vs BB, high dry flop, BTN ahead", () => {
    const tags = extractFeatures(SAMPLE_SUMMARY);
    for (const tag of ["srp", "ante", "spr-high", "board-high-dry", "range-advantage", "nut-advantage", "oop-checks-to-aggressor"] as const) {
      expect(tags).toContain(tag);
    }
    for (const tag of ["icm", "rake", "3bet-pot", "donk", "push-fold"] as const) expect(tags).not.toContain(tag);
  });

  it("counts preflop raises for the pot type", () => {
    const threeBet: HandSummary = {
      ...SAMPLE_SUMMARY,
      preflop: { ...SAMPLE_SUMMARY.preflop, decisions: [...SAMPLE_SUMMARY.preflop.decisions.slice(0, 2), { seat: "BB", action: "raise", sizeBb: 11 }, { seat: "BTN", action: "call" }] },
    };
    const tags = extractFeatures(threeBet);
    expect(tags).toContain("3bet-pot");
    expect(tags).toContain("oop-aggressor");
  });

  it("names ICM, rake and push/fold from the game", () => {
    expect(extractFeatures({ ...SAMPLE_SUMMARY, game: { ...SAMPLE_SUMMARY.game, icm: "bubble" } })).toContain("icm");
    expect(extractFeatures({ ...SAMPLE_SUMMARY, game: { format: "cash-6", stackBb: 100, rake: "online-low", icm: "chip-ev" } })).toContain("rake");
    const nash = { ...SAMPLE_SUMMARY.preflop.decisions[0], source: "nash-shove-fold" as const };
    expect(extractFeatures({ ...SAMPLE_SUMMARY, preflop: { ...SAMPLE_SUMMARY.preflop, decisions: [nash] } })).toContain("push-fold");
  });

  it("sizes bets against the pot", () => {
    expect(extractFeatures(withFlop([decision("BB", "Check", 6), decision("BTN", "Bet 2.0bb", 6)]))).toContain("small-bet");
    expect(extractFeatures(withFlop([decision("BB", "Check", 6), decision("BTN", "Bet 4.5bb", 6)]))).toContain("big-bet");
    const over = extractFeatures(withFlop([decision("BB", "Check", 6), decision("BTN", "Bet 9.0bb", 6)]));
    expect(over).toContain("overbet");
    expect(over).toContain("ip-aggressor-cbet");
  });

  it("spots a check-raise, a donk bet and a bet faced", () => {
    const xr = extractFeatures(withFlop([decision("BB", "Check", 6), decision("BTN", "Bet 2.0bb", 6), decision("BB", "Raise to 8.0bb", 8, 2)]));
    expect(xr).toContain("check-raise");
    expect(xr).toContain("facing-bet");
    expect(extractFeatures(withFlop([decision("BB", "Bet 2.0bb", 6)]))).toContain("donk");
  });
});

describe("boardTags", () => {
  it("tells flop textures apart", () => {
    expect(boardTags(["Kh", "7s", "2d"])).toEqual(["board-high-dry"]);
    expect(boardTags(["7h", "7s", "2d"])).toEqual(["board-paired", "board-low"]);
    expect(boardTags(["Ah", "9h", "4h"])).toEqual(["board-monotone"]);
    expect(boardTags(["9s", "8d", "6c"])).toEqual(["board-connected", "board-low"]);
    expect(boardTags(["As", "4d", "3c"])).toEqual(["board-connected"]);
  });
});
