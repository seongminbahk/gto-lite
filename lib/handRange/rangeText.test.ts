import { describe, expect, it } from "vitest";
import { ALL_HANDS } from "./handList";
import { formatRangeText, handsOfWeights, parseRangeText, rangeCombos, weightsOfHands, type RangeTextResult } from "./rangeText";

function weights(result: RangeTextResult): Map<string, number> {
  if (!result.ok) throw new Error(`${result.error}: ${result.token}`);
  return result.weights;
}

const hands = (text: string) => [...weights(parseRangeText(text)).keys()].sort();

describe("parseRangeText", () => {
  it("reads single hands, both kinds of an unpaired hand, and any case", () => {
    expect(hands("AA, AKs AKo")).toEqual(["AA", "AKo", "AKs"].sort());
    expect(hands("KQ")).toEqual(["KQo", "KQs"]);
    expect(hands("aks\nQJS")).toEqual(["AKs", "QJs"]);
    expect(hands("KAs")).toEqual(["AKs"]);
  });

  it("expands plus and dash ranges", () => {
    expect(hands("22+")).toHaveLength(13);
    expect(hands("77+")).toEqual(["77", "88", "99", "AA", "JJ", "KK", "QQ", "TT"].sort());
    expect(hands("ATs+")).toEqual(["AJs", "AKs", "AQs", "ATs"].sort());
    expect(hands("K9o+")).toEqual(["KJo", "KQo", "KTo", "K9o"].sort());
    expect(hands("99-66")).toEqual(["66", "77", "88", "99"]);
    expect(hands("K9s-K6s")).toEqual(["K6s", "K7s", "K8s", "K9s"]);
    expect(hands("T9s-65s")).toEqual(["65s", "76s", "87s", "98s", "T9s"]);
    expect(hands("J9s-64s")).toEqual(["64s", "75s", "86s", "97s", "T8s", "J9s"].sort());
  });

  it("reads weights as decimals or percents, the later of two winning", () => {
    const w = weights(parseRangeText("AA:1,AKs: 0.5, KQo:25%, QQ, QQ:0.4"));
    expect(Object.fromEntries(w)).toEqual({ AA: 1, AKs: 0.5, KQo: 0.25, QQ: 0.4 });
    expect(weights(parseRangeText("22+:0.5,AA")).get("22")).toBe(0.5);
  });

  it("drops hands at zero", () => {
    expect(hands("AA,KK:0")).toEqual(["AA"]);
  });

  it("names the token it can't read", () => {
    expect(parseRangeText("AA,AhKh")).toEqual({ ok: false, error: "combo", token: "AhKh" });
    expect(parseRangeText("AA,XYs")).toEqual({ ok: false, error: "unknown", token: "XYs" });
    expect(parseRangeText("AAs")).toMatchObject({ ok: false, error: "unknown" });
    expect(parseRangeText("AK-Q9")).toMatchObject({ ok: false, error: "unknown" });
    expect(parseRangeText("AKs-QJo")).toMatchObject({ ok: false, error: "unknown" });
    expect(parseRangeText("AKs:1.5")).toEqual({ ok: false, error: "weight", token: "AKs:1.5" });
    expect(parseRangeText("AKs:abc")).toMatchObject({ ok: false, error: "weight" });
    expect(parseRangeText("  ")).toMatchObject({ ok: false, error: "empty" });
    expect(parseRangeText("AA:0")).toMatchObject({ ok: false, error: "empty" });
  });
});

describe("formatRangeText", () => {
  it("writes runs of full hands as ranges and the rest with weights", () => {
    const w = weights(parseRangeText("77+,ATs+,K9s-K6s,AKo,QJo:0.5,72o:0.333"));
    expect(formatRangeText(w)).toBe("77+,ATs+,K9s-K6s,AKo,QJo:0.5,72o:0.33");
  });

  it("writes a lone hand at the top of its row as itself", () => {
    expect(formatRangeText(new Map([["AA", 1], ["AKs", 1]]))).toBe("AA,AKs");
  });

  it("reads back what it writes, for any range", () => {
    const ranges = [
      new Map(ALL_HANDS.map((h) => [h.hand, 1])),
      new Map(ALL_HANDS.map((h, i) => [h.hand, (i % 7) / 6])),
      new Map(ALL_HANDS.filter((_, i) => i % 3 === 0).map((h) => [h.hand, 1])),
    ];
    for (const range of ranges) {
      const back = weights(parseRangeText(formatRangeText(range)));
      for (const h of ALL_HANDS) expect(back.get(h.hand) ?? 0, h.hand).toBeCloseTo(range.get(h.hand) ?? 0, 2);
    }
    expect(formatRangeText(new Map(ALL_HANDS.map((h) => [h.hand, 1])))).toContain("22+");
  });
});

describe("rangeCombos", () => {
  it("counts combos by weight", () => {
    expect(rangeCombos(weights(parseRangeText("AA,AKs:0.5,AKo")))).toBe(6 + 2 + 12);
  });
});

describe("weightsOfHands / handsOfWeights", () => {
  it("takes a chart's action frequency as the weight and gives it back as a call", () => {
    const chart = [
      { hand: "AA", fold: 0, call: 0.2, raise: 0.8 },
      { hand: "72o", fold: 1, call: 0, raise: 0 },
    ];
    expect(Object.fromEntries(weightsOfHands(chart, "raise"))).toEqual({ AA: 0.8 });
    const rows = handsOfWeights(new Map([["AA", 0.8]]));
    expect(rows).toHaveLength(169);
    expect(rows.find((h) => h.hand === "AA")).toEqual({ hand: "AA", fold: expect.closeTo(0.2, 9), call: 0.8, raise: 0 });
    expect(rows.find((h) => h.hand === "72o")!.call).toBe(0);
  });
});
