import { RANKS } from "@/lib/cards";
import { ALL_HANDS, TOTAL_COMBOS, type CanonicalHand } from "@/lib/handRange/handList";
import type { FirstInAnchor } from "@/lib/solveEngine/gameFormat";
import { interpolateByStack } from "@/lib/solveEngine/interpolate";
import type { HandFrequency } from "@/types/rangeData";
import {
  MIX_BUFFER,
  FIRST_IN_WIDTHS_BY_STACK,
  JAM_MIN_STACK_BB,
  JAM_MAX_STACK_BB,
  JAM_MAX_SHARE,
  RAISE_KEEP_SHARE,
  BB_VS_LIMP_VALUE_WIDTH,
  BB_VS_LIMP_BLUFF_WIDTH,
  COLD_CALL_PER_SEAT_BEHIND,
  MIXED_THREE_BET_CORE,
  RAISE_VALUE_SHARE,
  BASE_CONTINUE_THRESHOLD,
  RAISE_DEPTH_TIGHTEN_FACTOR,
  IP_CONTINUE_MULTIPLIER,
  OOP_CONTINUE_MULTIPLIER,
  POT_ODDS_REFERENCE_RATIO,
  POT_ODDS_MIN_ADJUST,
  POT_ODDS_MAX_ADJUST,
  RAISE_FRACTION_BASE,
  RAISE_FRACTION_IP_BONUS,
  RAISE_FRACTION_DEPTH_PENALTY,
  RAISE_FRACTION_MIN,
  RAISE_FRACTION_MAX,
} from "./config";

/** Percentile ranking: hand -> 0 (best) .. 1 (worst). */
export type PercentileRanking = Map<string, number>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Soft threshold: 1 well inside the cutoff, 0 well outside, and a linear
 * ramp across a small buffer zone around `threshold` instead of a hard
 * cliff — so borderline hands get a partial/mixed frequency.
 */
function softInclude(percentile: number, threshold: number, buffer: number = MIX_BUFFER): number {
  const lo = threshold - buffer / 2;
  const hi = threshold + buffer / 2;
  if (percentile <= lo) return 1;
  if (percentile >= hi) return 0;
  return (hi - percentile) / (hi - lo);
}

function handFrequencies(
  ranking: PercentileRanking,
  build: (percentile: number) => { fold: number; call: number; raise: number },
): HandFrequency[] {
  return ALL_HANDS.map((h) => {
    const percentile = ranking.get(h.hand) ?? 1;
    const { fold, call, raise } = build(percentile);
    return { hand: h.hand, fold, call, raise };
  });
}

/** Share of combos seat `seatIdx` (0=UTG..6=SB) opens at this stack. BB (index 7) never opens. */
export function openWidthFor(
  seatIdx: number,
  effectiveStackBb: number,
  anchors: readonly FirstInAnchor[] = FIRST_IN_WIDTHS_BY_STACK,
): number {
  if (seatIdx < 0 || seatIdx > 6) {
    throw new Error(`openWidthFor: seat index ${seatIdx} cannot open`);
  }
  return interpolateByStack(anchors, effectiveStackBb, (a) => a.widths[seatIdx]);
}

function jamShareFor(effectiveStackBb: number): number {
  const depth = (JAM_MAX_STACK_BB - effectiveStackBb) / (JAM_MAX_STACK_BB - JAM_MIN_STACK_BB);
  return clamp(depth, 0, 1) * JAM_MAX_SHARE;
}

/** Splits a hand's raising frequency into raise and jam, per jamShareFor. Above its stacks the hand is left without an `allin` key. */
function withJams(hand: HandFrequency, percentile: number, raiseWidth: number, effectiveStackBb: number): HandFrequency {
  const jamShare = jamShareFor(effectiveStackBb);
  if (jamShare === 0 || percentile <= raiseWidth * RAISE_KEEP_SHARE) return hand;
  return { ...hand, raise: hand.raise * (1 - jamShare), allin: hand.raise * jamShare };
}

/** Opening decision: two-way, open (raise) or fold. */
export function generateOpeningScenario(
  ranking: PercentileRanking,
  seatIdx: number,
  effectiveStackBb: number,
  anchors: readonly FirstInAnchor[] = FIRST_IN_WIDTHS_BY_STACK,
): HandFrequency[] {
  const threshold = openWidthFor(seatIdx, effectiveStackBb, anchors);
  return handFrequencies(ranking, (p) => {
    const raise = softInclude(p, threshold);
    return { fold: 1 - raise, call: 0, raise };
  }).map((h) => withJams(h, ranking.get(h.hand) ?? 1, threshold, effectiveStackBb));
}

/**
 * SB folded to: raises some hands, limps most of the rest, folds the bottom.
 * `raiseSpread` of the raises are spread evenly over everything it plays and
 * the rest go to its best hands: deep, a solver's SB raises a slice of every
 * hand it plays rather than a top tier, so a 3-bet folds most of them out.
 */
export function generateSbFirstInScenario(
  ranking: PercentileRanking,
  effectiveStackBb: number,
  anchors: readonly FirstInAnchor[] = FIRST_IN_WIDTHS_BY_STACK,
  raiseSpread = 0,
): HandFrequency[] {
  const playThreshold = interpolateByStack(anchors, effectiveStackBb, (a) => a.sbPlay!);
  const raiseThreshold = interpolateByStack(anchors, effectiveStackBb, (a) => a.sbRaise!);
  return handFrequencies(ranking, (p) => {
    const play = softInclude(p, playThreshold);
    const raise = (1 - raiseSpread) * softInclude(p, raiseThreshold) + raiseSpread * play * (raiseThreshold / playThreshold);
    return { fold: 1 - play, call: play - raise, raise };
  }).map((h) => withJams(h, ranking.get(h.hand) ?? 1, raiseThreshold, effectiveStackBb));
}

export interface FacingRaiseParams {
  /** Number of raises/allin-as-raise events in the hand so far; always >= 1. */
  raiseDepth: number;
  /** Whether hero acts after the most recent aggressor postflop. */
  isIP: boolean;
  /** Pot size (bb) before hero acts, including all blinds/ante/prior bets. */
  potBb: number;
  /** Amount (bb) hero must add to call the current bet. */
  amountOwedBb: number;
  /** Share of combos the last aggressor's opening seat opens. */
  aggressorOpenWidth: number;
  /** The button's open width at this stack: against it the opener's width sets the continuing range in full. */
  referenceOpenWidth?: number;
  /**
   * How strongly a narrower opener narrows what continues: the continuing
   * range goes as (opener's width / the button's)^this. Default 0.5.
   */
  openerWidthExponent?: number;
  /** Seats left to act after hero; 0 means hero closes the action. */
  seatsBehind: number;
  /** What a cold caller keeps for each seat behind it past two. Default COLD_CALL_PER_SEAT_BEHIND. */
  coldCallPerSeatBehind?: number;
  /** 3-bet width as a share of the opener's width. */
  threeBetWidthRatio: number;
  /** Share of the BB's continuing range that a cold caller keeps: IP, with two seats behind. */
  coldCallBase: number;
  /** Multiplies the width that continues against an open. */
  continueFactor: number;
  coldCallOopMultiplier: number;
  /** Multiplies an in-position cold caller's share. Default 1. */
  coldCallIpFactor?: number;
  /** Shrinks the flats, but not the 3-bets, against an open someone already called. 1 when no one has. */
  callFactor: number;
  /** Multiplies what a seat closing the action continues with. */
  closingContinueFactor: number;
  /** Share of the 3-bets that are value. Default RAISE_VALUE_SHARE. */
  threeBetValueShare?: number;
  /**
   * Against an open, how far the 3-bets move from value hands plus suited
   * bluffs (0, the default) to mixed ones (1): the best hands up to
   * MIXED_THREE_BET_CORE of all combos every time, and the rest an even
   * slice of every hand that continues. A deep solver's in-position cold
   * caller 3-bets that way; only the very top (AA, AKs) 3-bets every time.
   */
  threeBetMix?: number;
  /** ICM's price on the chips a call risks: they count this many times. Default 1, chip EV. */
  bubbleFactor?: number;
  /**
   * A blind against an open: 3-bet bluffs are an even slice, up to this share
   * each, of the continuing hands that play worst out of position — offsuit
   * aces and broadways, and suited kings and queens with a low kicker — rather
   * than suited aces and connectors, which call. Unset: the suited bluffs.
   */
  blindBluffMaxShare?: number;
  /** With blindBluffMaxShare: how strongly its bluffs lean to the bottom of the continuing range, as depth^this. Default 0, an even slice. */
  blindBluffDepthTilt?: number;
  /** With blindBluffMaxShare: its candidates are the hands within this many times the continuing range. Default 1. */
  blindBluffReach?: number;
  /** With blindBluffMaxShare: the share of the bluffs that stay suited (the default candidates), the rest going to the blind's. Default 0. */
  blindSuitedBluffShare?: number;
  /** With blindSuitedBluffShare: those suited bluffs are low suited aces, then low suited kings (blockerSuitedBluffs). */
  blockerSuitedBluffs?: boolean;
}

function potOddsAdjustFor(params: FacingRaiseParams): number {
  const owed = params.amountOwedBb * (params.bubbleFactor ?? 1);
  const potOddsRatio = owed / (params.potBb + owed);
  return clamp(POT_ODDS_REFERENCE_RATIO / potOddsRatio, POT_ODDS_MIN_ADJUST, POT_ODDS_MAX_ADJUST);
}

/** A seat that closes the action has no squeeze to fear; the others keep a share that shrinks with each seat behind. */
function vsOpenContinueThreshold(params: FacingRaiseParams): number {
  const seatShare =
    params.seatsBehind === 0
      ? params.closingContinueFactor
      : params.coldCallBase *
        Math.pow(params.coldCallPerSeatBehind ?? COLD_CALL_PER_SEAT_BEHIND, params.seatsBehind - 2) *
        (params.isIP ? (params.coldCallIpFactor ?? 1) : params.coldCallOopMultiplier);
  // The square root keeps a cheap call from pulling in nearly every hand: price matters less than the opener's range here.
  // Measured from the button's width, so an exponent of 0.5 is the plain square root of the opener's.
  const reference = params.referenceOpenWidth ?? params.aggressorOpenWidth;
  const opener =
    params.openerWidthExponent === undefined
      ? Math.sqrt(params.aggressorOpenWidth * potOddsAdjustFor(params))
      : Math.sqrt(reference * potOddsAdjustFor(params)) * Math.pow(params.aggressorOpenWidth / reference, params.openerWidthExponent);
  return clamp(opener * seatShare * params.continueFactor, 0.01, 0.95);
}

function vsReraiseContinueThreshold(params: FacingRaiseParams): number {
  const depthFactor = Math.pow(RAISE_DEPTH_TIGHTEN_FACTOR, params.raiseDepth - 1);
  const positionMultiplier = params.isIP ? IP_CONTINUE_MULTIPLIER : OOP_CONTINUE_MULTIPLIER;
  return clamp(BASE_CONTINUE_THRESHOLD * depthFactor * positionMultiplier * potOddsAdjustFor(params), 0.01, 0.95);
}

function raiseFractionFor(params: FacingRaiseParams): number {
  const ipBonus = params.isIP ? RAISE_FRACTION_IP_BONUS : 0;
  const depthPenalty = RAISE_FRACTION_DEPTH_PENALTY * (params.raiseDepth - 1);
  return clamp(RAISE_FRACTION_BASE + ipBonus - depthPenalty, RAISE_FRACTION_MIN, RAISE_FRACTION_MAX);
}

/** Suited hands with a draw to the nuts or a straight: what a 3-bet bluffs with instead of the next-best value hands. */
export function isThreeBetBluffCandidate(h: CanonicalHand): boolean {
  if (h.type !== "suited") return false;
  const low = RANKS.indexOf(h.rankLow);
  return h.rankHigh === "A" ? low >= RANKS.indexOf("5") : low - RANKS.indexOf(h.rankHigh) <= 3;
}

/** Bluff frequency per hand: the best candidates outside the value range until `bluffWidth` of all combos is filled. */
function threeBetBluffs(ranking: PercentileRanking, valueThreshold: number, bluffWidth: number): Map<string, number> {
  const candidates = ALL_HANDS.filter(
    (h) => isThreeBetBluffCandidate(h) && (ranking.get(h.hand) ?? 1) > valueThreshold - MIX_BUFFER / 2,
  ).sort((a, b) => (ranking.get(a.hand) ?? 1) - (ranking.get(b.hand) ?? 1));
  const bluffs = new Map<string, number>();
  let combosLeft = bluffWidth * TOTAL_COMBOS;
  for (const h of candidates) {
    if (combosLeft <= 0) break;
    bluffs.set(h.hand, Math.min(1, combosLeft / h.combos));
    combosLeft -= h.combos;
  }
  return bluffs;
}

/**
 * Suited aces with a kicker of nine or lower, then suited kings with a kicker of eight or lower, each group an even
 * slice outside the value range, until `bluffWidth` of all combos is filled. A seat that isn't a blind 3-bets these,
 * and flats the suited broadways just below its value range instead.
 */
function blockerSuitedBluffs(ranking: PercentileRanking, valueThreshold: number, bluffWidth: number): Map<string, number> {
  const outsideValue = (h: CanonicalHand) => h.type === "suited" && (ranking.get(h.hand) ?? 1) > valueThreshold;
  const groups = [
    ALL_HANDS.filter((h) => outsideValue(h) && h.rankHigh === "A" && RANKS.indexOf(h.rankLow) >= RANKS.indexOf("9")),
    ALL_HANDS.filter((h) => outsideValue(h) && h.rankHigh === "K" && RANKS.indexOf(h.rankLow) >= RANKS.indexOf("8")),
  ];
  const bluffs = new Map<string, number>();
  let combosLeft = bluffWidth * TOTAL_COMBOS;
  for (const group of groups) {
    const groupCombos = group.reduce((sum, h) => sum + h.combos, 0);
    if (combosLeft <= 0 || groupCombos === 0) break;
    const share = Math.min(1, combosLeft / groupCombos);
    for (const h of group) bluffs.set(h.hand, share);
    combosLeft -= share * groupCombos;
  }
  return bluffs;
}

/** Offsuit aces and broadways, and suited kings and queens with a kicker of five or lower: they play poorly as calls out of position. */
export function isBlindBluffCandidate(h: CanonicalHand): boolean {
  if (h.type === "pair") return false;
  if (h.type === "offsuit") return h.rankHigh === "A" || h.rankHigh === "K" || (h.rankHigh === "Q" && RANKS.indexOf(h.rankLow) <= RANKS.indexOf("T"));
  return (h.rankHigh === "K" || h.rankHigh === "Q") && RANKS.indexOf(h.rankLow) >= RANKS.indexOf("5");
}

/** An even slice, at most `maxShare`, of the continuing blind-bluff candidates outside the value range, `bluffWidth` of all combos in all. */
function blindThreeBetBluffs(
  ranking: PercentileRanking,
  valueThreshold: number,
  continueThreshold: number,
  bluffWidth: number,
  maxShare: number,
  depthTilt = 0,
): Map<string, number> {
  const weights = new Map<string, number>();
  let mass = 0;
  for (const h of ALL_HANDS) {
    if (!isBlindBluffCandidate(h)) continue;
    const percentile = ranking.get(h.hand) ?? 1;
    // Tilted, the hands nearer the bottom of what continues bluff more, and the ones just below the value range flat.
    const depth = clamp((percentile - valueThreshold) / Math.max(continueThreshold - valueThreshold, Number.EPSILON), 0, 1);
    const w = softInclude(percentile, continueThreshold) * (1 - softInclude(percentile, valueThreshold)) * Math.pow(depth, depthTilt);
    if (w <= 0) continue;
    weights.set(h.hand, w);
    mass += w * h.combos;
  }
  const slice = mass > 0 ? clamp((bluffWidth * TOTAL_COMBOS) / mass, 0, maxShare) : 0;
  return new Map([...weights].map(([hand, w]) => [hand, w * slice]));
}

/** BB behind a limp: raises value and bluffs, checks the rest. Checking is free, so it never folds. */
export function generateBbVsLimpScenario(ranking: PercentileRanking, mixed?: { valueWidth: number; slice: number }): HandFrequency[] {
  if (mixed) {
    // A solver raises its best hands every time and a slice of nearly every other hand, weak offsuit ones included.
    return ALL_HANDS.map((h) => {
      const value = softInclude(ranking.get(h.hand) ?? 1, mixed.valueWidth);
      const raise = value + (1 - value) * mixed.slice;
      return { hand: h.hand, fold: 0, call: 1 - raise, raise };
    });
  }
  const bluffs = threeBetBluffs(ranking, BB_VS_LIMP_VALUE_WIDTH, BB_VS_LIMP_BLUFF_WIDTH);
  return ALL_HANDS.map((h) => {
    const raise = Math.max(softInclude(ranking.get(h.hand) ?? 1, BB_VS_LIMP_VALUE_WIDTH), bluffs.get(h.hand) ?? 0);
    return { hand: h.hand, fold: 0, call: 1 - raise, raise };
  });
}

/** Continues with the best `continueThreshold`; 3-bets the top `core` every time and an even slice of the rest, `threeBetWidth` in all. */
function mixedThreeBets(
  ranking: PercentileRanking,
  continueThreshold: number,
  threeBetWidth: number,
  core: number,
  callFactor: number,
): HandFrequency[] {
  const shares = ALL_HANDS.map((h) => {
    const percentile = ranking.get(h.hand) ?? 1;
    return { h, continues: softInclude(percentile, continueThreshold), top: softInclude(percentile, Math.min(core, continueThreshold), Math.min(MIX_BUFFER, core)) };
  });
  const mass = (weight: (s: (typeof shares)[number]) => number) => shares.reduce((sum, s) => sum + s.h.combos * weight(s), 0) / TOTAL_COMBOS;
  const coreMass = mass((s) => s.continues * s.top);
  const restMass = mass((s) => s.continues * (1 - s.top));
  const slice = restMass > 0 ? clamp((threeBetWidth - coreMass) / restMass, 0, 1) : 0;
  return shares.map(({ h, continues, top }) => {
    const raise = continues * (top + (1 - top) * slice);
    const call = (continues - raise) * callFactor;
    return { hand: h.hand, fold: 1 - raise - call, call, raise };
  });
}

function generateVsOpenScenario(ranking: PercentileRanking, params: FacingRaiseParams): HandFrequency[] {
  const continueThreshold = vsOpenContinueThreshold(params);
  const threeBetWidth = Math.min(params.aggressorOpenWidth * params.threeBetWidthRatio, continueThreshold);
  const mix = params.threeBetMix ?? 0;
  const topAndBluffs = valueAndBluffThreeBets(ranking, params, continueThreshold, threeBetWidth);
  if (mix === 0) return topAndBluffs;
  const mixed = mixedThreeBets(ranking, continueThreshold, threeBetWidth, MIXED_THREE_BET_CORE, params.callFactor);
  return topAndBluffs.map((h, i) => {
    const raise = (1 - mix) * h.raise + mix * mixed[i].raise;
    const call = (1 - mix) * h.call + mix * mixed[i].call;
    return { hand: h.hand, fold: 1 - raise - call, call, raise };
  });
}

function valueAndBluffThreeBets(
  ranking: PercentileRanking,
  params: FacingRaiseParams,
  continueThreshold: number,
  threeBetWidth: number,
): HandFrequency[] {
  const valueThreshold = threeBetWidth * (params.threeBetValueShare ?? RAISE_VALUE_SHARE);
  const bluffWidth = threeBetWidth - valueThreshold;
  let bluffs: Map<string, number>;
  if (params.blindBluffMaxShare === undefined) {
    bluffs = threeBetBluffs(ranking, valueThreshold, bluffWidth);
  } else {
    const suitedShare = params.blindSuitedBluffShare ?? 0;
    const suited = params.blockerSuitedBluffs
      ? blockerSuitedBluffs(ranking, valueThreshold, bluffWidth * suitedShare)
      : threeBetBluffs(ranking, valueThreshold, bluffWidth * suitedShare);
    const blind = blindThreeBetBluffs(ranking, valueThreshold, continueThreshold * (params.blindBluffReach ?? 1), bluffWidth * (1 - suitedShare), params.blindBluffMaxShare, params.blindBluffDepthTilt);
    bluffs = new Map([...suited]);
    for (const [hand, share] of blind) bluffs.set(hand, Math.min(1, (bluffs.get(hand) ?? 0) + share));
  }
  // The flats sit between the 3-bets and the continuing threshold; a caller in front narrows only that band.
  const callThreshold =
    params.callFactor === 1 ? continueThreshold : threeBetWidth + (continueThreshold - threeBetWidth) * params.callFactor;
  return ALL_HANDS.map((h) => {
    const percentile = ranking.get(h.hand) ?? 1;
    const raise = Math.max(softInclude(percentile, valueThreshold), bluffs.get(h.hand) ?? 0);
    const call = Math.max(softInclude(percentile, callThreshold) - raise, 0);
    return { hand: h.hand, fold: 1 - raise - call, call, raise };
  });
}

/**
 * Facing a raise: three-way decision (fold/call/re-raise). An open uses the
 * opener's width; deeper spots (vs-3bet, vs-4bet, ...) share one formula via
 * `params.raiseDepth` rather than a distinct function per named scenario.
 */
export function generateFacingRaiseScenario(
  ranking: PercentileRanking,
  params: FacingRaiseParams,
): HandFrequency[] {
  if (params.raiseDepth === 1) return generateVsOpenScenario(ranking, params);
  const continueThreshold = vsReraiseContinueThreshold(params);
  const raiseFraction = raiseFractionFor(params);
  const raiseThreshold = continueThreshold * raiseFraction;
  return handFrequencies(ranking, (p) => {
    const continueFreq = softInclude(p, continueThreshold);
    const raise = softInclude(p, raiseThreshold) * continueFreq;
    const call = continueFreq - raise;
    return { fold: 1 - continueFreq, call, raise };
  });
}
