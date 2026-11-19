import type { EquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { BASE_PLAYABILITY, computePlayabilityRanking, computeRangePlayabilityRanking, playabilityAt, type PlayabilityDepth } from "@/lib/equity/handStrength";
import { ALL_HANDS } from "@/lib/handRange/handList";
import { solvePushFold, type PushFoldResult } from "@/lib/nashSolver/pushFoldSolver";
import { BB_ANTE_BB, BIG_BLIND_BB, SMALL_BLIND_BB } from "./constants";
import { NO_RAKE_SETTINGS, type RakeSettings } from "./rake";
import { CHIP_EV, isChipEv, pushFoldPayoffs, type IcmStructure } from "./icm";

/**
 * Both results depend only on (matrix, stack, opponents behind, ante, rake, ICM, posted blinds), and the matrix is a
 * process-lifetime singleton — so /api/solve recomputes them at most once per
 * distinct input instead of on every request. Cached values are shared:
 * callers must treat them as read-only.
 */
const rankingsByMatrix = new WeakMap<EquityMatrix, Map<string, Map<string, number>>>();
const pushFoldByMatrix = new WeakMap<EquityMatrix, Map<string, PushFoldResult>>();

/** The playability ranking at this effective stack (see playabilityAt); with no stack, the bonuses as they are. */
export function getPlayabilityRanking(matrix: EquityMatrix, effectiveStackBb?: number): Map<string, number> {
  const depth = effectiveStackBb === undefined ? BASE_PLAYABILITY : playabilityAt(effectiveStackBb);
  const key = `${depth.bonusScale}|${depth.smallPairExtra}|${depth.suitedConnectorExtra}`;
  let byDepth = rankingsByMatrix.get(matrix);
  if (!byDepth) {
    byDepth = new Map();
    rankingsByMatrix.set(matrix, byDepth);
  }
  let ranking = byDepth.get(key);
  if (!ranking) {
    ranking = computePlayabilityRanking(matrix, depth);
    byDepth.set(key, ranking);
  }
  return ranking;
}

const rangeRankingsByMatrix = new WeakMap<EquityMatrix, Map<string, Map<string, number>>>();
const RANGE_RANKING_CACHE_LIMIT = 256;

/** getPlayabilityRanking with `weight` of the equity taken against `range` (see computeRangePlayabilityRanking). */
export function getRangePlayabilityRanking(
  matrix: EquityMatrix,
  range: ReadonlyMap<string, number>,
  weight: number,
  effectiveStackBb?: number,
  shift?: Pick<PlayabilityDepth, "offsuitExtra" | "suitedBroadwayExtra">,
): Map<string, number> {
  const atDepth = effectiveStackBb === undefined ? BASE_PLAYABILITY : playabilityAt(effectiveStackBb);
  const depth: PlayabilityDepth = { ...atDepth, ...shift };
  const rangeKey = ALL_HANDS.map((h) => range.get(h.hand) ?? 0).join(",");
  const key = `${weight}|${depth.bonusScale}|${depth.smallPairExtra}|${depth.suitedConnectorExtra}|${depth.offsuitExtra ?? 0}|${depth.suitedBroadwayExtra ?? 0}|${rangeKey}`;
  let byKey = rangeRankingsByMatrix.get(matrix);
  if (!byKey) {
    byKey = new Map();
    rangeRankingsByMatrix.set(matrix, byKey);
  }
  let ranking = byKey.get(key);
  if (!ranking) {
    ranking = computeRangePlayabilityRanking(matrix, range, weight, depth);
    // Opener ranges vary with the stack, rake and ICM a request names, so keep the cache from growing without end.
    if (byKey.size >= RANGE_RANKING_CACHE_LIMIT) byKey.clear();
    byKey.set(key, ranking);
  }
  return ranking;
}

export function getPushFoldResult(
  matrix: EquityMatrix,
  effectiveStackBb: number,
  opponentsBehind = 1,
  bbAnte = BB_ANTE_BB,
  rake: RakeSettings = NO_RAKE_SETTINGS,
  /** With ICM, the seats at the table and the stack every one of them, and the field, started with. */
  icm: { structure: IcmStructure; seats: number; stackBb: number } = { structure: CHIP_EV, seats: 0, stackBb: 0 },
  /** The blinds the shover and the caller posted, part of `effectiveStackBb`. Default: the SB shoving on the BB. */
  posted: { shoverBb: number; callerBb: number } = { shoverBb: SMALL_BLIND_BB, callerBb: BIG_BLIND_BB },
): PushFoldResult {
  let bySpot = pushFoldByMatrix.get(matrix);
  if (!bySpot) {
    bySpot = new Map();
    pushFoldByMatrix.set(matrix, bySpot);
  }
  const chipEv = isChipEv(icm.structure);
  const icmKey = chipEv ? "" : `:${icm.structure.id}:${icm.seats}:${icm.stackBb}`;
  const key = `${effectiveStackBb}:${opponentsBehind}:${bbAnte}:${posted.shoverBb}:${posted.callerBb}:${rake.structure.id}:${rake.noFlopNoDrop}${icmKey}`;
  let result = bySpot.get(key);
  if (!result) {
    const potBb = SMALL_BLIND_BB + BIG_BLIND_BB + bbAnte;
    const payoffs = chipEv ? undefined : pushFoldPayoffs(icm.structure, icm.seats, icm.stackBb, effectiveStackBb, potBb, posted);
    result = solvePushFold(matrix, {
      effectiveStackBb,
      opponentsBehind,
      bbAnte,
      shoverPostedBb: posted.shoverBb,
      callerPostedBb: posted.callerBb,
      rake,
      payoffs,
    });
    bySpot.set(key, result);
  }
  return result;
}
