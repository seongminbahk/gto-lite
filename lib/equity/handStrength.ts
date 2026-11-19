import { RANKS } from "@/lib/cards";
import { ALL_HANDS, TOTAL_COMBOS, type CanonicalHand } from "@/lib/handRange/handList";
import type { EquityMatrix } from "./loadEquityMatrix";
import { equityOf } from "./loadEquityMatrix";

/**
 * Combo-weighted equity of `hand` against a uniformly random opponent hand,
 * derived straight from the equity matrix (no separate data source). Ignores
 * card removal between hero's own hand and the villain combo pool — an
 * accepted simplification at this canonical-hand granularity.
 */
export function equityVsRandom(matrix: EquityMatrix, hand: string): number {
  let weighted = 0;
  for (const villain of ALL_HANDS) {
    weighted += equityOf(matrix, hand, villain.hand) * villain.combos;
  }
  return weighted / TOTAL_COMBOS;
}

/** Combo-weighted equity of `hand` against `range` (hand -> frequency); against a random hand when the range is empty. */
export function equityVsRange(matrix: EquityMatrix, hand: string, range: ReadonlyMap<string, number>): number {
  let weighted = 0;
  let combos = 0;
  for (const villain of ALL_HANDS) {
    const weight = (range.get(villain.hand) ?? 0) * villain.combos;
    if (weight === 0) continue;
    weighted += equityOf(matrix, hand, villain.hand) * weight;
    combos += weight;
  }
  return combos > 0 ? weighted / combos : equityVsRandom(matrix, hand);
}

/** Equity bonuses for hands that play better postflop than their all-in equity says. */
const SUITED_BONUS = 0.04;
const CONNECTED_BONUS_BY_GAP = [0.045, 0.03, 0.012]; // index = rank gap - 1
const WHEEL_ACE_BONUS = 0.025; // A5s-A2s: nut flush draw, wheel draw
const SMALL_PAIR_BONUS = 0.035; // 88 and below: set value
const WEAK_OFFSUIT_PENALTY = 0.025; // unconnected offsuit hands flop few draws

/** How much the playability bonuses count: scaled, plus extra for small pairs and suited connectors and one-gappers below an ace. */
export interface PlayabilityDepth {
  bonusScale: number;
  smallPairExtra: number;
  suitedConnectorExtra: number;
  /** Added to offsuit hands that aren't pairs (a 3-bet pot leaves them few ways to continue). */
  offsuitExtra?: number;
  /** Added to suited hands with both cards ten or higher. */
  suitedBroadwayExtra?: number;
}

/** The bonuses as they are. */
export const BASE_PLAYABILITY: PlayabilityDepth = { bonusScale: 1, smallPairExtra: 0, suitedConnectorExtra: 0 };

/**
 * The deeper the stacks, the more a set or a straight gets paid, so the more
 * small pairs and suited connectors are worth against their all-in equity.
 * Set against the public solver ranges' tournament opens and in-position cold
 * calls (lib/solveEngine/referenceRanges.test.ts), hand by hand: at 100bb
 * these bonuses took the opens from 85% agreement to 90% and the cold calls
 * from 68% to 73%; at 20bb smaller ones fit better. Interpolated between
 * these stacks and flat outside them.
 */
export const PLAYABILITY_BY_STACK: readonly ({ stackBb: number } & PlayabilityDepth)[] = [
  { stackBb: 20, bonusScale: 0.75, smallPairExtra: 0, suitedConnectorExtra: 0 },
  { stackBb: 40, bonusScale: 1, smallPairExtra: 0.03, suitedConnectorExtra: 0.02 },
  { stackBb: 100, bonusScale: 1.5, smallPairExtra: 0.03, suitedConnectorExtra: 0.02 },
];

export function playabilityAt(stackBb: number): PlayabilityDepth {
  const anchors = PLAYABILITY_BY_STACK;
  const found = anchors.findIndex((a) => a.stackBb >= stackBb);
  const hi = found === -1 ? anchors.length - 1 : found;
  const a = anchors[found <= 0 ? hi : hi - 1];
  const b = anchors[hi];
  const t = a === b ? 0 : (stackBb - a.stackBb) / (b.stackBb - a.stackBb);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    bonusScale: lerp(a.bonusScale, b.bonusScale),
    smallPairExtra: lerp(a.smallPairExtra, b.smallPairExtra),
    suitedConnectorExtra: lerp(a.suitedConnectorExtra, b.suitedConnectorExtra),
  };
}

function isSmallPair(h: CanonicalHand): boolean {
  return h.type === "pair" && RANKS.indexOf(h.rankHigh) >= RANKS.indexOf("8");
}

function playabilityBonus(h: CanonicalHand): number {
  const gap = RANKS.indexOf(h.rankLow) - RANKS.indexOf(h.rankHigh);
  if (h.type === "pair") return isSmallPair(h) ? SMALL_PAIR_BONUS : 0;
  const connected = CONNECTED_BONUS_BY_GAP[gap - 1] ?? 0;
  if (h.type === "offsuit") return connected > 0 ? connected / 2 : -WEAK_OFFSUIT_PENALTY;
  const wheelAce = h.rankHigh === "A" && RANKS.indexOf(h.rankLow) >= RANKS.indexOf("5");
  return SUITED_BONUS + connected + (wheelAce ? WHEEL_ACE_BONUS : 0);
}

function depthBonus(h: CanonicalHand, depth: PlayabilityDepth): number {
  const gap = RANKS.indexOf(h.rankLow) - RANKS.indexOf(h.rankHigh);
  const suitedConnector = h.type === "suited" && h.rankHigh !== "A" && gap <= 2;
  return (
    playabilityBonus(h) * depth.bonusScale +
    (isSmallPair(h) ? depth.smallPairExtra : 0) +
    (suitedConnector ? depth.suitedConnectorExtra : 0) +
    (h.type === "offsuit" ? (depth.offsuitExtra ?? 0) : 0) +
    (h.type === "suited" && RANKS.indexOf(h.rankLow) <= RANKS.indexOf("T") ? (depth.suitedBroadwayExtra ?? 0) : 0)
  );
}

/**
 * Percentile rank (0 = best) for ranges that see a flop: equity-vs-random plus
 * playabilityBonus, so 76s outranks K4o even though K4o wins more all-ins.
 * It's combo-weighted: a threshold of 0.3 selects about 30% of combos.
 * Push/fold doesn't use it, since its hands never play postflop.
 */
export function computePlayabilityRanking(matrix: EquityMatrix, depth: PlayabilityDepth = BASE_PLAYABILITY): Map<string, number> {
  return percentilesOf(ALL_HANDS.map((h) => ({ hand: h, score: equityVsRandom(matrix, h.hand) + depthBonus(h, depth) })));
}

/**
 * The playability ranking with `weight` of the equity taken against `range`
 * instead of a random hand. Facing an open, a hand the opener's range
 * dominates (KTo against AK, KQ, AT) wins less than its equity against a
 * random hand says, while a suited connector loses little: a solver's cold
 * caller flats 65s and 86s and folds KTo against an early open.
 */
export function computeRangePlayabilityRanking(
  matrix: EquityMatrix,
  range: ReadonlyMap<string, number>,
  weight: number,
  depth: PlayabilityDepth = BASE_PLAYABILITY,
): Map<string, number> {
  return percentilesOf(
    ALL_HANDS.map((h) => ({
      hand: h,
      score: (1 - weight) * equityVsRandom(matrix, h.hand) + weight * equityVsRange(matrix, h.hand, range) + depthBonus(h, depth),
    })),
  );
}

/** Best score first, each hand at the middle of its combos' share. */
function percentilesOf(scored: { hand: CanonicalHand; score: number }[]): Map<string, number> {
  scored.sort((a, b) => b.score - a.score);
  const ranking = new Map<string, number>();
  let combosAbove = 0;
  for (const { hand } of scored) {
    ranking.set(hand.hand, (combosAbove + hand.combos / 2) / TOTAL_COMBOS);
    combosAbove += hand.combos;
  }
  return ranking;
}
