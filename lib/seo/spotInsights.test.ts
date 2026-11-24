import { describe, expect, it } from "vitest";
import { ALL_HANDS } from "@/lib/handRange/handList";
import { edgeQuestions, mixedHandShares, rangeDiff } from "./spotInsights";
import { rangeCopy } from "./rangeCopy";
import { rangeStats } from "./spotSummary";

const range = (played: Record<string, number>) =>
  ALL_HANDS.map(({ hand }) => {
    const p = played[hand] ?? 0;
    return { hand, fold: 1 - p, call: 0, raise: p, allin: 0 };
  });

describe("spot insights", () => {
  it("lists the hands one range adds and drops against another, strongest first", () => {
    const diff = rangeDiff(range({ AA: 1, A9o: 1, K9o: 0.6, "22": 0.2 }), range({ AA: 1, "22": 1 }));
    expect(diff.added).toEqual(["A9o", "K9o"]);
    expect(diff.dropped).toEqual(["22"]);
  });

  it("lists mixed hands by how often they're played", () => {
    expect(mixedHandShares(range({ AA: 1, A3o: 0.25, K8o: 0.75, Q2o: 0.01 }))).toEqual([
      { hand: "K8o", played: 0.75 },
      { hand: "A3o", played: 0.25 },
    ]);
  });

  it("asks about the weakest hand of a row and the one below it", () => {
    const edges = edgeQuestions(range({ AKo: 1, AQo: 1, AJo: 0.75, ATo: 0.125 }));
    expect(edges).toEqual([{ category: "offsuitAces", edge: { hand: "AJo", played: 0.75 }, below: { hand: "ATo", played: 0.125 } }]);
  });
});

describe("range page questions", () => {
  const page = { format: "cash-6max", stackBb: 100, seat: "CO", kind: "open" } as const;
  const hands = range({ AA: 1, AKo: 1, AQo: 1, AJo: 0.7, ATo: 0.02 });
  const stats = rangeStats(hands);
  const stackComparison = { other: { ...page, stackBb: 40 }, diff: { added: ["AJo"], dropped: [] } };

  it("answers from the range, in both languages", () => {
    const faq = rangeCopy("en").faq(page, stats, edgeQuestions(hands), stackComparison);
    expect(faq.map((f) => f.question)).toEqual([
      "How often does the CO open at 100bb in 6-Max Cash?",
      "Should the CO open AJo at 100bb?",
      "How does the CO change between 40bb and 100bb?",
    ]);
    expect(faq[1].answer).toContain("ATo, the next one down, is folded.");
    expect(faq[2].answer).toBe("Compared with the CO at 40bb, the CO at 100bb adds 1 hand (AJo) and drops none.");
    const ko = rangeCopy("ko").faq(page, stats, edgeQuestions(hands), stackComparison);
    expect(ko[1].question).toBe("100bb CO에서 AJo를 오픈해야 하나요?");
    expect(ko[2].answer).toBe("40bb CO 대비 100bb CO: 1개 핸드 추가(AJo), 제외 없음.");
  });

  it("shortens long hand lists", () => {
    const many = ALL_HANDS.slice(0, 13).map((h) => h.hand);
    const line = rangeCopy("en").compareLine(page, { other: { ...page, seat: "HJ" }, diff: { added: many, dropped: [] } });
    expect(line).toMatch(/and 3 more\) and drops none\.$/);
  });
});
