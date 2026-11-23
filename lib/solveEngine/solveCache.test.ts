import { describe, expect, it } from "vitest";
import { loadEquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { computePlayabilityRanking, playabilityAt } from "@/lib/equity/handStrength";
import { solvePushFold } from "@/lib/nashSolver/pushFoldSolver";
import { rakeById } from "./rake";
import { getPlayabilityRanking, getPushFoldResult } from "./solveCache";

const matrix = loadEquityMatrix();

describe("getPlayabilityRanking", () => {
  it("returns the same computed ranking on repeat calls", () => {
    const first = getPlayabilityRanking(matrix);
    expect(getPlayabilityRanking(matrix)).toBe(first);
    expect(first).toEqual(computePlayabilityRanking(matrix));
  });

  it("keeps one ranking per depth", () => {
    const deep = getPlayabilityRanking(matrix, 100);
    expect(getPlayabilityRanking(matrix, 100)).toBe(deep);
    expect(deep).toEqual(computePlayabilityRanking(matrix, playabilityAt(100)));
    expect(getPlayabilityRanking(matrix, 20)).not.toEqual(deep);
  });

  it("keeps a shifted ranking apart, scaling the bonuses by bonusScaleFactor", () => {
    const base = getPlayabilityRanking(matrix);
    const shift = { bonusScaleFactor: 1.5, suitedConnectorExtra: 0.03 };
    const shifted = getPlayabilityRanking(matrix, undefined, 0, shift);
    expect(getPlayabilityRanking(matrix, undefined, 0, shift)).toBe(shifted);
    expect(shifted).toEqual(computePlayabilityRanking(matrix, { bonusScale: 1.5, smallPairExtra: 0, suitedConnectorExtra: 0.03, offsuitExtra: 0, suitedBroadwayExtra: 0 }));
    expect(shifted.get("54s")!).toBeLessThan(base.get("54s")!);
    expect(shifted.get("K5o")!).toBeGreaterThan(base.get("K5o")!);
  });
});

describe("getPushFoldResult", () => {
  it("caches per stack depth and matches a direct solve", () => {
    const at10 = getPushFoldResult(matrix, 10);
    expect(getPushFoldResult(matrix, 10)).toBe(at10);
    expect(at10).toEqual(solvePushFold(matrix, { effectiveStackBb: 10 }));

    const at20 = getPushFoldResult(matrix, 20);
    expect(at20).not.toBe(at10);
    expect(at20.shoveFrequency.get("72o")).toBeLessThanOrEqual(at10.shoveFrequency.get("72o")!);
  });

  it("caches each ante apart", () => {
    const withAnte = getPushFoldResult(matrix, 10, 1, 1);
    const noAnte = getPushFoldResult(matrix, 10, 1, 0);
    expect(noAnte).not.toBe(withAnte);
    expect(noAnte).toEqual(solvePushFold(matrix, { effectiveStackBb: 10, bbAnte: 0 }));
  });

  it("caches each rake apart", () => {
    const flat = getPushFoldResult(matrix, 10, 1, 0);
    const live = { structure: rakeById("live")!, noFlopNoDrop: true };
    const raked = getPushFoldResult(matrix, 10, 1, 0, live);
    const stolenToo = getPushFoldResult(matrix, 10, 1, 0, { ...live, noFlopNoDrop: false });
    expect(raked).not.toBe(flat);
    expect(stolenToo).not.toBe(raked);
    expect(getPushFoldResult(matrix, 10, 1, 0, live)).toBe(raked);
  });

  it("caches each number of opponents behind apart", () => {
    const headsUp = getPushFoldResult(matrix, 10);
    const fullTable = getPushFoldResult(matrix, 10, 7);
    expect(fullTable).not.toBe(headsUp);
    expect(getPushFoldResult(matrix, 10, 7)).toBe(fullTable);
    expect(fullTable).toEqual(solvePushFold(matrix, { effectiveStackBb: 10, opponentsBehind: 7 }));
  });
});
