import { describe, expect, it } from "vitest";
import { loadEquityMatrix } from "./loadEquityMatrix";
import { BASE_PLAYABILITY, computePlayabilityRanking, computeRangePlayabilityRanking, equityVsRandom, equityVsRange, playabilityAt } from "./handStrength";

describe("handStrength", () => {
  const matrix = loadEquityMatrix();

  const ranking = computePlayabilityRanking(matrix);

  it("ranks AA first and 72o near the bottom", () => {
    expect(ranking.get("AA")!).toBeLessThan(0.01);
    expect(ranking.get("72o")!).toBeGreaterThan(0.9);
  });

  it("is combo-weighted: every percentile sits inside [0, 1] and the last hand ends at the top", () => {
    const values = [...ranking.values()];
    expect(values).toHaveLength(169);
    expect(Math.max(...values)).toBeGreaterThan(0.99);
    expect(Math.min(...values)).toBeGreaterThan(0);
  });

  it("ranks hands that play well postflop above offsuit hands that only win all-ins", () => {
    expect(ranking.get("76s")!).toBeLessThan(ranking.get("K4o")!);
    expect(ranking.get("A5s")!).toBeLessThan(ranking.get("A9o")!);
    expect(ranking.get("22")!).toBeLessThan(ranking.get("Q7o")!);
  });

  it("gives AA higher equity vs random than 72o", () => {
    expect(equityVsRandom(matrix, "AA")).toBeGreaterThan(equityVsRandom(matrix, "72o"));
  });

  it("ranks small pairs and suited connectors higher the deeper the stacks", () => {
    const at20 = computePlayabilityRanking(matrix, playabilityAt(20));
    const at100 = computePlayabilityRanking(matrix, playabilityAt(100));
    for (const hand of ["22", "54s", "76s"]) expect(at100.get(hand)!).toBeLessThan(at20.get(hand)!);
    expect(at100.get("KTo")!).toBeGreaterThan(at20.get("KTo")!);
    expect(at100.get("AA")!).toBe(at20.get("AA")!);
  });

  it("interpolates the depth bonuses between their stacks and holds them flat outside", () => {
    expect(playabilityAt(10)).toEqual(playabilityAt(20));
    expect(playabilityAt(150)).toEqual(playabilityAt(100));
    expect(playabilityAt(70).bonusScale).toBeCloseTo((playabilityAt(40).bonusScale + playabilityAt(100).bonusScale) / 2, 9);
    expect(computePlayabilityRanking(matrix, BASE_PLAYABILITY)).toEqual(ranking);
  });

  it("takes equity against a range, and against a random hand when the range is empty", () => {
    const tight = new Map(["AA", "KK", "QQ", "AKs", "AKo", "AQs", "KQs"].map((h) => [h, 1]));
    expect(equityVsRange(matrix, "KTo", tight)).toBeLessThan(equityVsRandom(matrix, "KTo") - 0.1);
    expect(equityVsRange(matrix, "65s", tight)).toBeGreaterThan(equityVsRange(matrix, "KTo", tight));
    expect(equityVsRange(matrix, "KTo", new Map())).toBe(equityVsRandom(matrix, "KTo"));
  });

  it("ranks hands an opener's range dominates lower against that range", () => {
    const tight = new Map(["AA", "KK", "QQ", "JJ", "TT", "AKs", "AKo", "AQs", "AQo", "AJs", "KQs", "KQo", "ATs"].map((h) => [h, 1]));
    const vsRange = computeRangePlayabilityRanking(matrix, tight, 1);
    expect(vsRange.get("KTo")!).toBeGreaterThan(ranking.get("KTo")!);
    expect(vsRange.get("65s")!).toBeLessThan(vsRange.get("KTo")!);
    expect(computeRangePlayabilityRanking(matrix, tight, 0)).toEqual(ranking);
  });

  it("orders pocket pairs by rank", () => {
    expect(ranking.get("AA")!).toBeLessThan(ranking.get("KK")!);
    expect(ranking.get("KK")!).toBeLessThan(ranking.get("QQ")!);
  });

  it("lifts only the hands with the most raw equity with topEquityExtra", () => {
    const lifted = computePlayabilityRanking(matrix, { ...BASE_PLAYABILITY, topEquityExtra: 0.02 });
    const byEquity = computePlayabilityRanking(matrix, { bonusScale: 0, smallPairExtra: 0, suitedConnectorExtra: 0 });
    let moved = 0;
    for (const [hand, before] of ranking) {
      const after = lifted.get(hand)!;
      if (byEquity.get(hand)! < 0.15) expect(after).toBeLessThanOrEqual(before);
      else expect(after).toBeGreaterThanOrEqual(before);
      if (after !== before) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });
});
