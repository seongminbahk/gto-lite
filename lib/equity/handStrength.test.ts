import { describe, expect, it } from "vitest";
import { loadEquityMatrix } from "./loadEquityMatrix";
import { BASE_PLAYABILITY, computePlayabilityRanking, equityVsRandom, playabilityAt } from "./handStrength";

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

  it("orders pocket pairs by rank", () => {
    expect(ranking.get("AA")!).toBeLessThan(ranking.get("KK")!);
    expect(ranking.get("KK")!).toBeLessThan(ranking.get("QQ")!);
  });
});
