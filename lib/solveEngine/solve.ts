import type { HandFrequency, Position, RangeSource } from "@/types/rangeData";
import type { EquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { ALL_HANDS, TOTAL_COMBOS } from "@/lib/handRange/handList";
import { SEAT_ORDER, postflopSeatIndex, seatIndex } from "@/lib/actionTree/seatOrder";
import {
  generateBbVsLimpScenario,
  generateFacingRaiseScenario,
  generateOpeningScenario,
  generateSbFirstInScenario,
  openWidthFor,
  type FacingRaiseParams,
} from "@/lib/heuristicRanges/generateScenario";
import {
  ICM_RISK_SPR_EXPONENT,
  LIMP_RERAISE_MIN_EQUITY,
  RAISE_VALUE_SHARE,
  RAKE_CONTINUE_FALLOFF,
  RAKE_RELIEF_CONTINUE_GAIN,
  RAKE_RELIEF_POT_GROWTH,
  RAKE_RELIEF_RERAISE_CUT,
  RAKE_RELIEF_SB_PLAY_GAIN,
  RAKE_RELIEF_SUITED_CONNECTOR_GAIN,
  RAKE_RELIEF_SB_RAISE_CUT,
  RERAISE_KEEP_BASE,
} from "@/lib/heuristicRanges/config";
import { generateCallShoveScenario, generateVsReraiseScenario, type JamDefense, type VsReraiseParams } from "@/lib/heuristicRanges/vsReraise";
import type { FrequencyMap } from "@/lib/nashSolver/pushFoldSolver";
import { firstInWidthsUnder, tunedAt, type FirstInAnchor, type GameFormat } from "./gameFormat";
import { computeRawRaiseTo } from "./actionSizing";
import { aggressiveFrequencies } from "./postflopHandoff";
import { callersOf, type PotState, type SeatDecision } from "./potState";
import { DEFAULT_RAKE_SETTINGS, NO_RAKE_SETTINGS, rakeReliefAt, rakeShare, type RakeSettings } from "./rake";
import { shouldUseNash } from "./classify";
import { BIG_BLIND_BB, SHORT_RERAISE_JAM_SHARE, SMALL_BLIND_BB } from "./constants";
import { CHIP_EV, equalStackBubbleFactor, type IcmStructure } from "./icm";
import { getPlayabilityRanking, getPushFoldResult, getRangePlayabilityRanking } from "./solveCache";

export interface SolvedNode {
  hands: HandFrequency[];
  source: RangeSource;
}

function shoveFrequencyToHands(shoveFreq: Map<string, number>): HandFrequency[] {
  return ALL_HANDS.map((h) => {
    const allin = shoveFreq.get(h.hand) ?? 0;
    return { hand: h.hand, fold: 1 - allin, call: 0, raise: 0, allin };
  });
}

function callFrequencyToHands(callFreq: Map<string, number>): HandFrequency[] {
  return ALL_HANDS.map((h) => {
    const call = callFreq.get(h.hand) ?? 0;
    return { hand: h.hand, fold: 1 - call, call, raise: 0 };
  });
}

/** The hands a seat came out of a decision with: the frequency of what it chose there. */
function rangeAfter(
  matrix: EquityMatrix,
  seat: Position,
  decision: SeatDecision,
  effectiveStackBb: number,
  rake: RakeSettings,
  icm: IcmStructure,
): FrequencyMap {
  const { hands } = solveActiveSeat(matrix, seat, decision.state, effectiveStackBb, rake, icm);
  const aggressive = decision.action === "raise" || decision.action === "allin";
  const frequencies = aggressive ? aggressiveFrequencies(hands) : hands.map((h) => h.call);
  return new Map(hands.map((h, i) => [h.hand, frequencies[i]]));
}

function shareOfCombos(range: FrequencyMap): number {
  return ALL_HANDS.reduce((sum, h) => sum + (range.get(h.hand) ?? 0) * h.combos, 0) / TOTAL_COMBOS;
}

/** What every branch of solveActiveSeat reads about the spot in front of the active seat. */
interface SpotContext {
  matrix: EquityMatrix;
  activeSeat: Position;
  potState: PotState;
  effectiveStackBb: number;
  rake: RakeSettings;
  icm: IcmStructure;
  /** Seats the table has. */
  seats: number;
  /** ICM's price on losing the active seat's stack to the raiser; 1 in chip EV. Every seat starts with the same stack, so it doesn't depend on who. */
  allInBubbleFactor: number;
  /** The format tuned to this stack. */
  format: GameFormat;
  firstInWidths: readonly FirstInAnchor[];
  hasOpener: boolean;
  remainingStackBb: number;
  amountOwedBb: number;
  lastAggressor: Position | null;
  ownDecision: SeatDecision | undefined;
  raiserDecision: SeatDecision | null | undefined;
  /** What the active seat and the last raiser came out of their last decisions with. */
  heroRange: FrequencyMap | undefined;
  villainRange: FrequencyMap | null | undefined;
}

/** A spot facing a raise: the last aggressor is known. */
interface FacingRaiseContext extends SpotContext {
  lastAggressor: Position;
  isIP: boolean;
  isBlind: boolean;
  calledLast: boolean;
}

function spotContext(
  matrix: EquityMatrix,
  activeSeat: Position,
  potState: PotState,
  effectiveStackBb: number,
  rake: RakeSettings,
  icm: IcmStructure,
): SpotContext {
  const format = tunedAt(potState.format, effectiveStackBb);
  const seats = SEAT_ORDER.length - potState.format.absentSeats.length;
  const remainingStackBb = effectiveStackBb - (potState.committed[activeSeat] ?? 0);
  const lastAggressor = potState.lastAggressor;
  const ownDecision = potState.lastDecision[activeSeat];
  const raiserDecision = lastAggressor && potState.lastDecision[lastAggressor];
  return {
    matrix,
    activeSeat,
    potState,
    effectiveStackBb,
    rake,
    icm,
    seats,
    allInBubbleFactor: equalStackBubbleFactor(icm, seats, effectiveStackBb, remainingStackBb),
    format,
    firstInWidths: firstInWidthsUnder(format, rake),
    hasOpener: potState.raiseDepth >= 1,
    remainingStackBb,
    amountOwedBb: potState.currentBetToCall - (potState.committed[activeSeat] ?? 0),
    lastAggressor,
    ownDecision,
    raiserDecision,
    heroRange: ownDecision && rangeAfter(matrix, activeSeat, ownDecision, effectiveStackBb, rake, icm),
    villainRange: raiserDecision && rangeAfter(matrix, lastAggressor, raiserDecision, effectiveStackBb, rake, icm),
  };
}

/**
 * Computes the 169-hand action-frequency distribution for whichever seat is
 * currently active, given the replayed pot state. Routes to the Nash
 * push/fold solver or the generalized heuristic engine per classify.ts.
 */
export function solveActiveSeat(
  matrix: EquityMatrix,
  activeSeat: Position,
  potState: PotState,
  effectiveStackBb: number,
  rake: RakeSettings = NO_RAKE_SETTINGS,
  icm: IcmStructure = CHIP_EV,
): SolvedNode {
  const ctx = spotContext(matrix, activeSeat, potState, effectiveStackBb, rake, icm);
  if (shouldUseNash(effectiveStackBb, ctx.remainingStackBb, potState.potBb, ctx.hasOpener)) return solveShoveSpot(ctx);
  if (!ctx.hasOpener) return solveFirstIn(ctx);
  const lastAggressor = ctx.lastAggressor!;
  return solveFacingRaise({
    ...ctx,
    lastAggressor,
    isIP: postflopSeatIndex(activeSeat) > postflopSeatIndex(lastAggressor),
    isBlind: activeSeat === "SB" || activeSeat === "BB",
    calledLast: ctx.ownDecision?.action === "call",
  });
}

/** What ICM does to the price of a call that doesn't get the stack in at once: less of the all-in premium the deeper the stacks behind it. */
function partialRiskBubbleFactor(ctx: SpotContext): number {
  const behindBb = ctx.remainingStackBb - ctx.amountOwedBb;
  const spr = behindBb / (ctx.potState.potBb + ctx.amountOwedBb);
  const weight = spr <= 1 ? 1 : Math.pow(spr, -ICM_RISK_SPR_EXPONENT);
  return 1 + (ctx.allInBubbleFactor - 1) * weight;
}

/** Both seats came here with ranges of their own, so the raise is priced against them. */
function handsFacingRaise(ctx: SpotContext): ctx is SpotContext & { heroRange: FrequencyMap; villainRange: FrequencyMap } {
  return !!ctx.heroRange && !!ctx.villainRange && shareOfCombos(ctx.heroRange) > 0 && shareOfCombos(ctx.villainRange) > 0;
}

/** The blind a seat posts before the cards, which is part of its stack. */
function postedBlindBb(seat: Position): number {
  return seat === "SB" ? SMALL_BLIND_BB : seat === "BB" ? BIG_BLIND_BB : 0;
}

/**
 * The SB re-raised the BB's raise over its own limp, and the BB jammed. That
 * range is only the limp range's best hands, so calling only what beats the
 * BB's jamming range folds so much that the BB could jam everything it would
 * have folded. Returns those hands and what the jam added, or undefined
 * anywhere else.
 */
function limpRaiseJamDefense(ctx: SpotContext): JamDefense | undefined {
  const { ownDecision, potState, activeSeat } = ctx;
  const limp = ownDecision?.state.lastDecision[activeSeat];
  const jam = potState.lastDecision.BB;
  const isoRaise = ownDecision?.state.lastDecision.BB;
  // With no range of its own here (a line the strategy never takes), there is nothing to defend.
  if (!handsFacingRaise(ctx) || activeSeat !== "SB" || ownDecision?.action !== "raise" || limp?.action !== "call" || limp.state.raiseDepth !== 0 || !jam || !isoRaise) return undefined;
  // What the BB brought to the jam, and how often it would have folded each hand there instead.
  const reached = rangeAfter(ctx.matrix, "BB", isoRaise, ctx.effectiveStackBb, ctx.rake, ctx.icm);
  const answer = solveActiveSeat(ctx.matrix, "BB", jam.state, ctx.effectiveStackBb, ctx.rake, ctx.icm).hands;
  const foldingRange = new Map(answer.map((h) => [h.hand, (reached.get(h.hand) ?? 0) * h.fold]));
  const villainRiskBb = (potState.committed.BB ?? 0) - (jam.state.committed.BB ?? 0);
  return { foldingRange, villainRiskBb };
}

function solveShoveSpot(ctx: SpotContext): SolvedNode {
  const { matrix, potState, rake, villainRange } = ctx;
  // A fresh shove is the game the Nash solver models; anything after more
  // action has a bigger pot and known ranges of its own, so price it directly.
  if (villainRange && shareOfCombos(villainRange) > 0 && (ctx.ownDecision || potState.raiseDepth >= 2)) {
    return {
      source: "heuristic-approx",
      hands: generateCallShoveScenario(matrix, {
        heroRange: handsFacingRaise(ctx) ? ctx.heroRange : new Map(ALL_HANDS.map((h) => [h.hand, 1])),
        villainRange,
        potBb: potState.potBb,
        amountOwedBb: ctx.amountOwedBb,
        rake: rake.structure,
        bubbleFactor: ctx.allInBubbleFactor,
        jamDefense: limpRaiseJamDefense(ctx),
        // A raise that leaves chips behind can be re-raised all-in, which the strongest hands do.
        jamShareOfContinues: potState.currentBetToCall < ctx.effectiveStackBb ? SHORT_RERAISE_JAM_SHARE : 0,
      }),
    };
  }
  const shover = ctx.lastAggressor ?? ctx.activeSeat;
  const opponentsBehind = Math.max(1, SEAT_ORDER.length - 1 - seatIndex(shover));
  // Facing the shove, hero is the caller; before it, the caller is taken to be the BB.
  const caller = ctx.hasOpener ? ctx.activeSeat : shover === "BB" ? "SB" : "BB";
  const result = getPushFoldResult(
    matrix,
    ctx.effectiveStackBb,
    opponentsBehind,
    ctx.format.bbAnteBb,
    rake,
    { structure: ctx.icm, seats: ctx.seats, stackBb: ctx.effectiveStackBb },
    { shoverBb: postedBlindBb(shover), callerBb: postedBlindBb(caller) },
  );
  return {
    source: "nash-shove-fold",
    hands: ctx.hasOpener ? callFrequencyToHands(result.callFrequency) : shoveFrequencyToHands(result.shoveFrequency),
  };
}

function solveFirstIn(ctx: SpotContext): SolvedNode {
  const { activeSeat, effectiveStackBb, format, firstInWidths } = ctx;
  const ranking = getPlayabilityRanking(ctx.matrix, ctx.format.playabilityByStack ? ctx.effectiveStackBb : undefined, rakeSuitedConnectorGain(ctx));
  if (activeSeat === "BB") {
    const mix = format.bbVsLimpMix && effectiveStackBb >= (format.bbVsLimpMix.minStackBb ?? 0) ? format.bbVsLimpMix : undefined;
    return { source: "heuristic-approx", hands: generateBbVsLimpScenario(ranking, mix) };
  }
  if (activeSeat === "SB" && format.sbCanLimp) {
    // Under ICM the SB raises about 1/bubble factor as much and limps the rest
    // (a commercial solver's 40bb near bubble and 10%-left trees, read 2026-11-17).
    // A limped pot is small, so only a rake lighter than the default on small pots (none at all) moves it.
    const relief = lighterThanDefaultRake(ctx) ? rakeReliefAt(RAKE_RELIEF_POT_GROWTH * 2 * BIG_BLIND_BB, ctx.rake.structure) : 0;
    const anchors = (ctx.allInBubbleFactor > 1 ? firstInWidths.map((a) => ({ ...a, sbRaise: a.sbRaise! / ctx.allInBubbleFactor })) : firstInWidths).map((a) => ({
      ...a,
      sbRaise: a.sbRaise! * Math.max(0, 1 - RAKE_RELIEF_SB_RAISE_CUT * relief),
      sbPlay: a.sbPlay === undefined ? undefined : a.sbPlay * (1 + RAKE_RELIEF_SB_PLAY_GAIN * relief),
    }));
    return { source: "heuristic-approx", hands: generateSbFirstInScenario(ranking, effectiveStackBb, anchors, format.sbRaiseSpread) };
  }
  return {
    source: "heuristic-approx",
    hands: generateOpeningScenario(ranking, seatIndex(activeSeat), effectiveStackBb, firstInWidths),
  };
}

/**
 * A blind facing an open ranks its hands by their equity against the opener's
 * range alone, plus playability: it closes the action at a good price, so what
 * counts is how a hand fares against what was opened. Against a random hand
 * J9o and A4o outrank 65s and 86s, and the blind flatted the offsuit hands and
 * folded the suited ones; a commercial solver (read 2026-11-17) does the
 * reverse. Hand agreement rose in every format read, 0.3–1.7pp: cash 6-max
 * 88.3→89.2%, 8-max 85.7→87.0%, MTT 100bb 88.9→90.2%, 20bb 86.0→87.7%,
 * near-bubble 40bb 86.3→87.3%.
 */
const BLIND_DEFENSE_RANGE_EQUITY_WEIGHT = 1;

/** Facing an open, a seat ranks its hands partly by their equity against the opener's range. */
function facingRaiseRanking(ctx: FacingRaiseContext): Map<string, number> {
  const stack = ctx.format.playabilityByStack ? ctx.effectiveStackBb : undefined;
  const weight = ctx.format.coldCallRangeEquityWeight ?? 0;
  const coldCall = ctx.potState.raiseDepth === 1 && !ctx.isBlind && !ctx.ownDecision;
  const hasVillainRange = !!ctx.villainRange && shareOfCombos(ctx.villainRange) > 0;
  const reraiseWeight = ctx.format.reraiseRangeEquityWeight ?? 0;
  if (ctx.potState.raiseDepth >= 2 && reraiseWeight > 0 && hasVillainRange) {
    // Only against a blind's 3-bet: an in-position 3-bettor's tighter range has the reference flatting small pairs and 4-betting suited broadways instead.
    const blindRaiser = ctx.potState.raiseDepth === 2 && (ctx.lastAggressor === "SB" || ctx.lastAggressor === "BB");
    return getRangePlayabilityRanking(ctx.matrix, ctx.villainRange!, reraiseWeight, stack, blindRaiser ? ctx.format.reraisePlayabilityShift : undefined, rakeSuitedConnectorGain(ctx));
  }
  if (ctx.isBlind && ctx.potState.raiseDepth === 1 && !ctx.ownDecision && hasVillainRange) {
    return getRangePlayabilityRanking(ctx.matrix, ctx.villainRange!, BLIND_DEFENSE_RANGE_EQUITY_WEIGHT, stack, undefined, rakeSuitedConnectorGain(ctx));
  }
  if (weight === 0 || !coldCall || !hasVillainRange) return getPlayabilityRanking(ctx.matrix, stack, rakeSuitedConnectorGain(ctx));
  return getRangePlayabilityRanking(ctx.matrix, ctx.villainRange!, weight, stack, undefined, rakeSuitedConnectorGain(ctx));
}

function solveFacingRaise(ctx: FacingRaiseContext): SolvedNode {
  const ranking = facingRaiseRanking(ctx);
  const hands = handsFacingRaise(ctx)
    ? generateVsReraiseScenario(ctx.matrix, ranking, vsReraiseParams(ctx, ctx.heroRange, ctx.villainRange))
    : generateFacingRaiseScenario(ranking, facingRaiseParams(ctx));
  const answered = blindJamsOrFolds(ctx) ? hands.map((h) => ({ ...h, fold: h.fold + h.call, call: 0 })) : hands;
  return { source: "heuristic-approx", hands: reraisesAllIn(ctx) ? jamReraises(answered) : answered };
}

/** A blind whose 3-bet met a 4-bet, out of position with little behind for a flop: 5-bets or folds (GameFormat.blindFacingFourBetCalls). */
function blindJamsOrFolds(ctx: FacingRaiseContext): boolean {
  return ctx.format.blindFacingFourBetCalls === false && ctx.isBlind && !ctx.isIP && ctx.potState.raiseDepth >= 3;
}

/** A re-raise that would put in most of a stack is made all-in instead. */
function reraisesAllIn(ctx: FacingRaiseContext): boolean {
  const { format, potState, effectiveStackBb } = ctx;
  const jamShare = format.jamReraiseShare && (potState.raiseDepth >= 2 ? format.jamReraiseShare.fourBet : format.jamReraiseShare.threeBet);
  return jamShare !== undefined && Math.min(computeRawRaiseTo(ctx.activeSeat, potState, effectiveStackBb), effectiveStackBb) >= jamShare * effectiveStackBb;
}

function jamReraises(hands: HandFrequency[]): HandFrequency[] {
  return hands.map((h) => ({ ...h, raise: 0, allin: (h.allin ?? 0) + h.raise }));
}

/** A 3-bet made over an open someone called is a squeeze. */
function facingSqueeze(ctx: FacingRaiseContext): boolean {
  return ctx.potState.raiseDepth === 2 && !!ctx.raiserDecision && callersOf(ctx.raiserDecision.state, ctx.lastAggressor).length > 0;
}

/** The 4-bet width and bluff share against this 3-bet. */
function fourBetTuning(ctx: FacingRaiseContext): { widthRatio: number; bluffShare: number } {
  const { format, potState } = ctx;
  // A 3-bet made in position on an opener that isn't a blind.
  const facingThreeBetInPosition = potState.raiseDepth === 2 && !ctx.isIP && !ctx.isBlind && !ctx.calledLast;
  return (facingThreeBetInPosition && format.fourBet.vsInPosition) || (sbFacingBbThreeBet(ctx) && format.fourBet.sbVsBb) || format.fourBet;
}

function sbFacingBbThreeBet(ctx: FacingRaiseContext): boolean {
  return ctx.potState.raiseDepth === 2 && ctx.activeSeat === "SB" && ctx.lastAggressor === "BB" && ctx.ownDecision?.action === "raise";
}

/** The share of a plain 3-bet's continuing range kept here: less against a squeeze, and in the SB's own 3-bet spots. */
function reraiseKeepFactor(ctx: FacingRaiseContext): number {
  const { format, potState, activeSeat, lastAggressor, calledLast } = ctx;
  const reraisedOwnRaise = potState.raiseDepth === 2 && ctx.ownDecision?.action === "raise";
  return (
    (facingSqueeze(ctx) ? (calledLast ? format.squeezeKeepFactor.caller : format.squeezeKeepFactor.opener) : 1) *
    (activeSeat === "SB" && reraisedOwnRaise ? (format.sbOpenerKeepFactor ?? 1) : 1) *
    (lastAggressor === "SB" && reraisedOwnRaise ? (format.sbThreeBetKeepFactor ?? 1) : 1)
  );
}

function vsReraiseParams(ctx: FacingRaiseContext, heroRange: FrequencyMap, villainRange: FrequencyMap): VsReraiseParams {
  const { format, potState, calledLast } = ctx;
  const villainShare = shareOfCombos(villainRange);
  const common = {
    heroRange,
    villainRange,
    isIP: ctx.isIP,
    potBb: potState.potBb,
    amountOwedBb: ctx.amountOwedBb,
    // The SB's ICM raise range is already narrow, so against the BB's 3-bet it
    // continues about as it would in chips (same solver, 40bb near bubble).
    bubbleFactor: sbFacingBbThreeBet(ctx) ? 1 : partialRiskBubbleFactor(ctx),
  };
  if (potState.raiseDepth < 2) {
    // A limper raised over: the 4-bet tuning doesn't apply, and nothing was compared here.
    return {
      ...common,
      raiseWidth: villainShare * format.threeBetWidthRatio * RAISE_VALUE_SHARE,
      bluffWidth: 0,
      keepBase: RERAISE_KEEP_BASE,
      maxRaiseShareOfKept: format.calledReraiseShareCap,
      // A re-raise that goes all-in wins the pot often enough on its own; one that doesn't has to be ahead.
      ...(!reraisesAllIn(ctx) && { minValueEquity: LIMP_RERAISE_MIN_EQUITY }),
      rake: ctx.rake.structure,
    };
  }
  const fiveBet = format.fiveBet && {
    ...format.fiveBet,
    widthRatio: ctx.isBlind ? (format.fiveBet.blindWidthRatio ?? format.fiveBet.widthRatio) : format.fiveBet.widthRatio,
  };
  const fourBet = potState.raiseDepth >= 3 && fiveBet ? fiveBet : fourBetTuning(ctx);
  return {
    ...common,
    raiseWidth: villainShare * fourBet.widthRatio * fourBetValueShare(ctx) * Math.max(0, 1 - RAKE_RELIEF_RERAISE_CUT * calledPotRakeRelief(ctx)),
    // A flatting range is capped: it has nothing to spare for bluffs.
    bluffWidth: calledLast ? 0 : villainShare * fourBet.widthRatio * fourBet.bluffShare,
    keepBase: potState.raiseDepth >= 3 ? (format.facingFourBetKeepBase ?? format.reraiseKeepBase) : format.reraiseKeepBase,
    keepFactor: reraiseKeepFactor(ctx),
    valueMixSpread: format.reraiseValueMixSpread,
    blockerBluffMaxShare: format.reraiseBlockerBluffMaxShare,
    ...(calledLast ? { maxRaiseShareOfKept: format.calledReraiseShareCap } : { valueInDeckCombos: true }),
    rake: ctx.rake.structure,
  };
}

/** The value share of a 4-bet: its own against a blind's heads-up 3-bet. */
function fourBetValueShare(ctx: FacingRaiseContext): number {
  const { format, potState, lastAggressor } = ctx;
  const vsBlind = potState.raiseDepth === 2 && !ctx.isBlind && (lastAggressor === "SB" || lastAggressor === "BB") && !facingSqueeze(ctx);
  return (vsBlind && format.fourBet.vsBlindValueShare) || format.fourBet.valueShare;
}

/** A cash game raked more lightly than the default; tournaments have no rake to be lighter than. */
/** With a lighter rake than the default, the suited connectors' extra playability (formats ranked the same at every depth only). */
function rakeSuitedConnectorGain(ctx: SpotContext): number {
  if (ctx.format.playabilityByStack || !lighterThanDefaultRake(ctx)) return 0;
  return RAKE_RELIEF_SUITED_CONNECTOR_GAIN * (1 - rakeShare(ctx.rake.structure) / rakeShare(DEFAULT_RAKE_SETTINGS.structure));
}

function lighterThanDefaultRake(ctx: SpotContext): boolean {
  return !!ctx.format.allowsRake && rakeShare(ctx.rake.structure) < rakeShare(DEFAULT_RAKE_SETTINGS.structure);
}

/** How much lighter than the default the rake is on the pot this call is likely to grow into. */
function calledPotRakeRelief(ctx: FacingRaiseContext): number {
  if (!lighterThanDefaultRake(ctx)) return 0;
  return rakeReliefAt(RAKE_RELIEF_POT_GROWTH * (ctx.potState.potBb + ctx.amountOwedBb), ctx.rake.structure);
}

/**
 * The share of a flat kept under this rake. A rake at or above the default
 * falls off with its share of a typical pot; a lighter one widens by how much
 * less it takes of the pot this call grows into, so NL500's 1bb cap, which
 * rakes a single-raised pot like NL10 does, leaves the BB's defense alone.
 */
function rakeContinueFactor(ctx: FacingRaiseContext): number {
  const share = rakeShare(ctx.rake.structure);
  const drawnAt = rakeShare(DEFAULT_RAKE_SETTINGS.structure);
  if (!lighterThanDefaultRake(ctx)) return Math.exp(-RAKE_CONTINUE_FALLOFF * share);
  return Math.exp(-RAKE_CONTINUE_FALLOFF * drawnAt + RAKE_RELIEF_CONTINUE_GAIN * calledPotRakeRelief(ctx));
}

/** The 3-bet width as a share of the opener's: the BB against the SB, the SB, other blinds, and seats that aren't blinds. */
function threeBetWidthRatioFor(ctx: FacingRaiseContext, blindVsBlind: GameFormat["blindVsBlind"]): number {
  const { format, activeSeat } = ctx;
  return (
    blindVsBlind?.threeBetWidthRatio ??
    (activeSeat === "SB" && format.sbThreeBetWidthRatio !== undefined
      ? format.sbThreeBetWidthRatio
      : ctx.isBlind
        ? format.threeBetWidthRatio
        : format.nonBlindThreeBetWidthRatio)
  );
}

/** Flats shrink for the SB, and for each seat that already called, harder when that caller is in position on hero. */
function flatCallFactor(ctx: FacingRaiseContext): number {
  const { format, activeSeat } = ctx;
  return (
    (activeSeat === "SB" ? (format.sbFlatFactor ?? 1) : 1) *
    callersOf(ctx.potState, activeSeat).reduce(
      (factor, caller) =>
        factor * (postflopSeatIndex(caller) > postflopSeatIndex(activeSeat) ? format.overcallFactor.ipCaller : format.overcallFactor.oopCaller),
      1,
    )
  );
}

/**
 * Under ICM a blind 3-bets about 1/bubble factor as wide as in chip EV: a
 * commercial solver's 8-max near-bubble 20bb and 40bb (read 2026-11-17) cut
 * blind 3-bets to 0.58–0.69 of its chip-EV ones at a bubble factor of about
 * 1.6, while seats with players behind barely changed theirs.
 */
function facingRaiseParams(ctx: FacingRaiseContext): FacingRaiseParams {
  const { format, potState, activeSeat, lastAggressor, effectiveStackBb, firstInWidths } = ctx;
  // BB's raise over a limp leaves SB closing the action, though BB sits "behind" it.
  const seatsBehind = seatIndex(lastAggressor) > seatIndex(activeSeat) ? 0 : SEAT_ORDER.length - 1 - seatIndex(activeSeat);
  // The BB against the SB's first-in raise, heads-up and in position on it.
  const blindVsBlind = potState.raiseDepth === 1 && activeSeat === "BB" && lastAggressor === "SB" ? format.blindVsBlind : undefined;
  return {
    raiseDepth: potState.raiseDepth,
    isIP: ctx.isIP,
    potBb: potState.potBb,
    amountOwedBb: ctx.amountOwedBb,
    aggressorOpenWidth: openWidthFor(Math.min(seatIndex(lastAggressor), 6), effectiveStackBb, firstInWidths),
    referenceOpenWidth: openWidthFor(seatIndex("BTN"), effectiveStackBb, firstInWidths),
    openerWidthExponent: seatsBehind === 0 ? format.closingWidthExponent : ctx.isBlind ? undefined : format.coldCallWidthExponent,
    coldCallIpFactor: format.coldCallIpFactor,
    seatsBehind,
    coldCallPerSeatBehind: ctx.isBlind ? undefined : format.coldCallPerSeatBehind,
    threeBetWidthRatio: threeBetWidthRatioFor(ctx, blindVsBlind) / (ctx.isBlind ? ctx.allInBubbleFactor : 1),
    coldCallBase: format.coldCallBase,
    coldCallOopMultiplier: format.coldCallOopMultiplier,
    closingContinueFactor: format.closingContinueFactor * (blindVsBlind?.continueFactor ?? 1),
    threeBetValueShare: (ctx.isBlind ? format.blindThreeBetValueShare : format.coldCallThreeBetValueShare) || format.threeBetValueShare,
    threeBetMix: ctx.isBlind ? undefined : format.coldCallThreeBetMix,
    continueFactor: rakeContinueFactor(ctx),
    callFactor: flatCallFactor(ctx),
    bubbleFactor: partialRiskBubbleFactor(ctx),
    blindBluffMaxShare: ctx.isBlind ? format.blindBluffMaxShare : format.coldCallBluffMaxShare,
    blindBluffReach: ctx.isBlind ? undefined : format.coldCallBluffReach,
    blindBluffDepthTilt: blindVsBlind ? format.bbBluffDepthTilt : undefined,
    blindSuitedBluffShare: activeSeat === "SB" ? format.sbSuitedBluffShare : ctx.isBlind ? undefined : format.coldCallSuitedBluffShare,
    blockerSuitedBluffs: !ctx.isBlind,
  };
}
