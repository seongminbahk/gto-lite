import { equityOf, type EquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { ALL_HANDS, HAND_BY_LABEL, TOTAL_COMBOS } from "@/lib/handRange/handList";
import { weightedEquityVsRange, type FrequencyMap } from "@/lib/nashSolver/pushFoldSolver";
import { netPot, type RakeTerms } from "@/lib/solveEngine/rake";
import type { HandFrequency } from "@/types/rangeData";
import {
  EQUITY_REALIZATION_IP,
  EQUITY_REALIZATION_OOP,
  RERAISE_KEEP_MAX,
  RERAISE_KEEP_MIN,
  RERAISE_KEEP_PER_EQUITY,
} from "./config";
import { isThreeBetBluffCandidate } from "./generateScenario";
import type { CanonicalHand } from "@/lib/handRange/handList";

/** Suited aces and kings that aren't already value: they hold a card of the raiser's AA, KK and AK. */
function isBlockerBluffCandidate(h: CanonicalHand): boolean {
  return h.type === "suited" && (h.rankHigh === "A" || h.rankHigh === "K");
}

/** Aces before kings, wheel aces first (they also make straights), then down the kicker. */
function blockerRank(hand: string): number {
  const high = hand[0] === "A" ? 0 : 100;
  const low = "5432TJQK9876".indexOf(hand[1]);
  return high + (low < 0 ? 50 : low);
}

export interface VsReraiseParams {
  /** The hands this seat got here with. Anything else folds: it isn't really being dealt here. */
  heroRange: FrequencyMap;
  /** The hands behind the raise being faced, bluffs and all. */
  villainRange: FrequencyMap;
  isIP: boolean;
  /** Pot (bb) before hero acts. */
  potBb: number;
  /** Amount (bb) hero must add to call. */
  amountOwedBb: number;
  /** Share of all combos that re-raises for value: the best hands kept. */
  raiseWidth: number;
  /** Share of all combos that re-raises as a bluff, from hands that would otherwise fold. */
  bluffWidth: number;
  /** The share of the range kept before price and equity move it. */
  keepBase: number;
  /** Cap on the value re-raises, as a share of what's kept. Default: none. */
  maxRaiseShareOfKept?: number;
  /** Scales what's kept, e.g. facing a squeeze. Default 1. */
  keepFactor?: number;
  /**
   * Count each value re-raise as all of that hand's combos, however often hero
   * got here with it: right for a raising range that mixes its best hands in,
   * wrong for a flatting one, whose few strong hands are the ones that raise.
   */
  valueInDeckCombos?: boolean;
  /** Hands with less equity than this against the raiser don't re-raise for value. Default: none. */
  minValueEquity?: number;
  /**
   * How gradually value re-raises give way to calls, as a share of the kept
   * range: hands across this band at the edge of the value range mix both,
   * best hands raising most, instead of the top raising and the rest flatting.
   * Default 0, a hard edge.
   */
  valueMixSpread?: number;
  /**
   * Bluff with blockers: suited aces and kings, which hold the cards of the
   * raiser's best hands, re-raise up to this share of each hand, calls included,
   * instead of bluffing with the next hands that would fold. Default: none.
   */
  blockerBluffMaxShare?: number;
  rake: RakeTerms;
  /** ICM's price on the chips a call risks: losing them counts this many times. Default 1, chip EV. */
  bubbleFactor?: number;
}

/**
 * The hands that would fold to hero's raise rather than jam it, and what a jam
 * adds to the pot. A range that only calls what beats the jamming range can
 * fold so often that these hands jam at a profit: see generateCallShoveScenario.
 */
export interface JamDefense {
  foldingRange: FrequencyMap;
  villainRiskBb: number;
}

export type VsShoveParams = Pick<VsReraiseParams, "heroRange" | "villainRange" | "potBb" | "amountOwedBb" | "rake" | "bubbleFactor"> & {
  jamDefense?: JamDefense;
  /**
   * The raise isn't all-in: this share of the continuing combos, those with the
   * most equity against the raiser, re-raise all-in instead of calling.
   */
  jamShareOfContinues?: number;
};

/**
 * Facing a raise that all but gets the stacks in, equity is what a hand wins:
 * it continues if that beats the real price of the real pot. It only calls,
 * unless `jamShareOfContinues` has its best continues move all-in.
 * With `jamDefense`, it also calls with its best hands against the folding
 * range until jamming all of that range no longer beats folding it.
 */
export function generateCallShoveScenario(matrix: EquityMatrix, params: VsShoveParams): HandFrequency[] {
  const { heroRange, villainRange, potBb, rake } = params;
  const owed = params.amountOwedBb * (params.bubbleFactor ?? 1);
  const equityToCall = owed / netPot(potBb + owed, rake);
  const calls = new Map(
    ALL_HANDS.map((h) => [h.hand, (heroRange.get(h.hand) ?? 0) > 0 && weightedEquityVsRange(matrix, h.hand, villainRange) > equityToCall ? 1 : 0]),
  );
  if (params.jamDefense) defendAgainstJams(matrix, params, params.jamDefense, calls);
  const jams = jamsAmongContinues(matrix, heroRange, villainRange, calls, params.jamShareOfContinues ?? 0);
  return ALL_HANDS.map((h) => {
    const continues = calls.get(h.hand)!;
    const allin = jams.get(h.hand) ?? 0;
    return { hand: h.hand, fold: 1 - continues, call: continues - allin, raise: 0, ...(allin > 0 && { allin }) };
  });
}

/** The continuing hands with the most equity against the raiser, up to `share` of the continuing combos, and how much of each goes all-in. */
function jamsAmongContinues(
  matrix: EquityMatrix,
  heroRange: FrequencyMap,
  villainRange: FrequencyMap,
  calls: Map<string, number>,
  share: number,
): Map<string, number> {
  const jams = new Map<string, number>();
  if (share <= 0) return jams;
  const continuing = ALL_HANDS.filter((h) => calls.get(h.hand) === 1 && (heroRange.get(h.hand) ?? 0) > 0)
    .map((h) => ({ hand: h.hand, combos: heroRange.get(h.hand)! * h.combos, equity: weightedEquityVsRange(matrix, h.hand, villainRange) }))
    .sort((a, b) => b.equity - a.equity);
  let left = share * continuing.reduce((sum, h) => sum + h.combos, 0);
  for (const h of continuing) {
    if (left <= 0) break;
    const part = Math.min(1, left / h.combos);
    jams.set(h.hand, part);
    left -= part * h.combos;
  }
  return jams;
}

/** Adds calls, best against the folding range first, until jamming that whole range is worth no more than folding it. */
function defendAgainstJams(matrix: EquityMatrix, params: VsShoveParams, defense: JamDefense, calls: Map<string, number>): void {
  const { heroRange, potBb, amountOwedBb, rake } = params;
  const potBeforeJam = potBb - defense.villainRiskBb;
  const finalPot = netPot(potBb + amountOwedBb, rake);
  const villains = ALL_HANDS.filter((v) => (defense.foldingRange.get(v.hand) ?? 0) > 0).map((v) => ({
    hand: v.hand,
    weight: defense.foldingRange.get(v.hand)! * v.combos,
  }));
  const heroes = ALL_HANDS.filter((h) => (heroRange.get(h.hand) ?? 0) > 0).map((h) => ({ hand: h.hand, weight: heroRange.get(h.hand)! * h.combos }));
  const heroCombos = heroes.reduce((sum, h) => sum + h.weight, 0);
  if (villains.length === 0 || heroCombos === 0) return;
  // Per villain hand: hero combos that call, and the villain's equity summed over them.
  const called = villains.map(() => 0);
  const equitySum = villains.map(() => 0);
  const addCall = (hand: string, weight: number) =>
    villains.forEach((v, i) => {
      called[i] += weight;
      equitySum[i] += weight * equityOf(matrix, v.hand, hand);
    });
  for (const h of heroes) if (calls.get(h.hand) === 1) addCall(h.hand, h.weight);
  const jamGain = () =>
    villains.reduce((sum, v, i) => {
      const callShare = called[i] / heroCombos;
      const showdown = called[i] > 0 ? (equitySum[i] / called[i]) * finalPot - defense.villainRiskBb : 0;
      return sum + v.weight * ((1 - callShare) * potBeforeJam + callShare * showdown);
    }, 0);
  const candidates = heroes
    .filter((h) => calls.get(h.hand) !== 1)
    .map((h) => ({ ...h, equity: weightedEquityVsRange(matrix, h.hand, defense.foldingRange) }))
    .sort((a, b) => b.equity - a.equity);
  for (const h of candidates) {
    if (jamGain() <= 0) break;
    calls.set(h.hand, 1);
    addCall(h.hand, h.weight);
  }
}

/**
 * Facing a re-raise with a range of its own, a seat keeps a share of it set by
 * how far the range's equity against the raiser's actual range clears the
 * price — so the width follows the raiser's range, the price, position and
 * rake, not a fixed share of the deck. The range's most playable hands are the
 * ones kept, not its best all-in equities, which would drop suited connectors
 * for weak offsuit hands. Of those, the ones with the most equity against the
 * raiser re-raise for value — AK before JJ, as solvers have it — and the most
 * playable bluff candidates among the hands that would fold re-raise as bluffs.
 */
export function generateVsReraiseScenario(
  matrix: EquityMatrix,
  ranking: Map<string, number>,
  params: VsReraiseParams,
): HandFrequency[] {
  const { heroRange, villainRange, isIP, potBb, raiseWidth, bluffWidth, keepBase, rake } = params;
  const realization = isIP ? EQUITY_REALIZATION_IP : EQUITY_REALIZATION_OOP;
  const owed = params.amountOwedBb * (params.bubbleFactor ?? 1);
  const equityToCall = owed / (realization * netPot(potBb + owed, rake));

  const reached = ALL_HANDS.filter((h) => (heroRange.get(h.hand) ?? 0) > 0)
    .map((h) => ({
      hand: h.hand,
      combos: h.combos * heroRange.get(h.hand)!,
      equity: weightedEquityVsRange(matrix, h.hand, villainRange),
    }))
    .sort((a, b) => (ranking.get(a.hand) ?? 1) - (ranking.get(b.hand) ?? 1));
  const rangeCombos = reached.reduce((sum, h) => sum + h.combos, 0);
  const rangeEquity = reached.reduce((sum, h) => sum + h.equity * h.combos, 0) / rangeCombos;
  const keep = keepBase + RERAISE_KEEP_PER_EQUITY * (rangeEquity - equityToCall);

  const frequencies = new Map<string, { continueFreq: number; raise: number }>();
  let continueCombosLeft = Math.min(RERAISE_KEEP_MAX, Math.max(RERAISE_KEEP_MIN, keep)) * (params.keepFactor ?? 1) * rangeCombos;
  let raiseCombosLeft = Math.min(raiseWidth * TOTAL_COMBOS, continueCombosLeft * (params.maxRaiseShareOfKept ?? 1));
  // The most playable hands are the ones kept.
  for (const { hand, combos } of reached) {
    const continueFreq = Math.min(1, continueCombosLeft / combos);
    continueCombosLeft = Math.max(0, continueCombosLeft - continueFreq * combos);
    frequencies.set(hand, { continueFreq, raise: 0 });
  }
  // Of those, the ones with the most equity against the raiser re-raise for value. With
  // `valueInDeckCombos`, a range that mixes a few of its best hands in doesn't re-raise its middle to make up the count.
  const byEquity = [...reached].sort((x, y) => y.equity - x.equity);
  const spread = (params.valueMixSpread ?? 0) * rangeCombos;
  if (spread > 0) {
    // Each hand raises the share of its combos that sits above the edge, the edge blurred across `spread`.
    const target = raiseCombosLeft;
    let before = 0;
    for (const { hand, combos, equity } of byEquity) {
      if (equity < (params.minValueEquity ?? 0)) break;
      const entry = frequencies.get(hand)!;
      const deckCombos = params.valueInDeckCombos ? HAND_BY_LABEL.get(hand)!.combos : combos;
      const middle = before + deckCombos / 2;
      before += deckCombos;
      const raise = Math.min(entry.continueFreq, Math.max(0, Math.min(1, (target + spread / 2 - middle) / spread)));
      if (raise > 0) frequencies.set(hand, { ...entry, raise });
      if (middle > target + spread / 2) break;
    }
  } else {
    for (const { hand, combos, equity } of byEquity) {
      if (raiseCombosLeft <= 0 || equity < (params.minValueEquity ?? 0)) break;
      const entry = frequencies.get(hand)!;
      const deckCombos = params.valueInDeckCombos ? HAND_BY_LABEL.get(hand)!.combos : combos;
      const raise = Math.min(entry.continueFreq, raiseCombosLeft / deckCombos);
      raiseCombosLeft = Math.max(0, raiseCombosLeft - raise * deckCombos);
      frequencies.set(hand, { ...entry, raise });
    }
  }

  let bluffCombosLeft = bluffWidth * TOTAL_COMBOS;
  if (params.blockerBluffMaxShare !== undefined) {
    // Suited aces first, then kings; within each, the most playable first.
    const blockers = reached
      .filter(({ hand }) => isBlockerBluffCandidate(HAND_BY_LABEL.get(hand)!))
      .sort((a, b) => blockerRank(a.hand) - blockerRank(b.hand));
    for (const { hand, combos } of blockers) {
      if (bluffCombosLeft <= 0) break;
      const entry = frequencies.get(hand)!;
      const room = params.blockerBluffMaxShare - entry.raise;
      if (room <= 0) continue;
      const bluff = Math.min(room, bluffCombosLeft / combos);
      frequencies.set(hand, { continueFreq: Math.max(entry.continueFreq, entry.raise + bluff), raise: entry.raise + bluff });
      bluffCombosLeft -= bluff * combos;
    }
    bluffCombosLeft = 0;
  }
  for (const { hand, combos } of reached) {
    if (bluffCombosLeft <= 0) break;
    const entry = frequencies.get(hand)!;
    if (!isThreeBetBluffCandidate(HAND_BY_LABEL.get(hand)!) || entry.continueFreq >= 1) continue;
    const bluff = Math.min(1 - entry.continueFreq, bluffCombosLeft / combos);
    frequencies.set(hand, { continueFreq: entry.continueFreq + bluff, raise: entry.raise + bluff });
    bluffCombosLeft -= bluff * combos;
  }

  return ALL_HANDS.map((h) => {
    const { continueFreq, raise } = frequencies.get(h.hand) ?? { continueFreq: 0, raise: 0 };
    return { hand: h.hand, fold: 1 - continueFreq, call: continueFreq - raise, raise };
  });
}
