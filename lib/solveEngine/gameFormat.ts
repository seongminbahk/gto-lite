import type { Position } from "@/types/rangeData";
import {
  CASH_BB_VS_SB_CONTINUE_FACTOR,
  CASH_BB_VS_SB_THREE_BET_WIDTH_RATIO,
  CASH_CALLED_RERAISE_SHARE_CAP,
  CASH_CLOSING_WIDTH_EXPONENT,
  CASH_COLD_CALL_BASE,
  CASH_COLD_CALL_OOP_MULTIPLIER,
  CASH_FIRST_IN_WIDTHS,
  CASH_FOUR_BET_BLUFF_SHARE,
  CASH_FOUR_BET_VS_IN_POSITION_WIDTH_RATIO,
  CASH_SB_FOUR_BET_BLUFF_SHARE,
  CASH_SB_FOUR_BET_WIDTH_RATIO,
  CASH_SB_THREE_BET_KEEP_FACTOR,
  CASH_FOUR_BET_WIDTH_RATIO,
  CASH_NON_BLIND_THREE_BET_WIDTH_RATIO,
  CASH_OVERCALL_FACTOR_IP_CALLER,
  CASH_OVERCALL_FACTOR_OOP_CALLER,
  CASH_RERAISE_KEEP_BASE,
  CASH_CALLER_SQUEEZE_KEEP_FACTOR,
  CASH_SQUEEZE_KEEP_FACTOR,
  CASH_THREE_BET_WIDTH_RATIO,
  COLD_CALL_BASE,
  COLD_CALL_OOP_MULTIPLIER,
  FIRST_IN_WIDTHS_BY_STACK,
  RAISE_VALUE_SHARE,
  RAKE_OPEN_SENSITIVITY,
  RERAISE_KEEP_BASE,
  RERAISE_MAX_SHARE_OF_KEPT,
  THREE_BET_WIDTH_RATIO,
} from "@/lib/heuristicRanges/config";
import {
  BB_ANTE_BB,
  CASH_FOUR_BET_IP_MULTIPLIER,
  CASH_FOUR_BET_OOP_MULTIPLIER,
  CASH_OPEN_RAISE_BB,
  CASH_SB_OPEN_RAISE_BB,
  CASH_SQUEEZE_BLIND_MULTIPLIER,
  CASH_SQUEEZE_PER_CALLER,
  CASH_THREE_BET_BB_MULTIPLIER,
  CASH_THREE_BET_BB_OVER_SB_MULTIPLIER,
  CASH_THREE_BET_IP_MULTIPLIER,
  CASH_THREE_BET_SB_MULTIPLIER,
  OPEN_RAISE_BTN_DEEP_BB,
  OPEN_RAISE_BTN_SHALLOW_BB,
  OPEN_RAISE_CO_DEEP_BB,
  OPEN_RAISE_CO_SHALLOW_BB,
  OPEN_RAISE_EARLY_DEEP_BB,
  OPEN_RAISE_EARLY_SHALLOW_BB,
  OPEN_RAISE_SB_DEEP_BB,
  OPEN_RAISE_SB_SHALLOW_BB,
  REACTIVE_RAISE_IP_MULTIPLIER,
  REACTIVE_RAISE_OOP_MULTIPLIER,
} from "./constants";
import { anchorsAround, lerp } from "./interpolate";
import { DEFAULT_RAKE_SETTINGS, rakeShare, type RakeSettings } from "./rake";

export type GameFormatId = "tournament-8" | "cash-6" | "cash-8";

/** Open raise-to (bb) at or below OPEN_RAISE_SCALING_MIN_STACK_BB, and at STACK_MAX_BB. */
export interface OpenSizeRange {
  shallowBb: number;
  deepBb: number;
}

/** Re-raise size as a multiple of the raise it faces, by position against the raiser. */
export interface ReraiseSizes {
  /** Over an open: in position, and from each blind out of position. */
  threeBet: { ip: number; sbOop: number; bbOop: number };
  /** The BB's 3-bet over the SB's raise, in position on it. Default `threeBet.ip`. */
  bbOverSb?: number;
  /** Over a 3-bet or more. */
  fourBetPlus: { ip: number; oop: number };
  /** The SB's 4-bet over the BB's 3-bet of its own raise. Default `fourBetPlus.oop`. */
  sbOverBb?: number;
  /**
   * Over an open that someone called: a blind's multiple of the open with one
   * caller, an in-position seat's added to its plain 3-bet, plus `perCaller`
   * for each further caller. Without it a squeeze is sized like a 3-bet.
   */
  squeeze?: { blind: number; perCaller: number };
  /** Sizes that change with depth, interpolated between these stacks and flat outside them. Overrides threeBet, fourBetPlus and the blind-vs-blind sizes. */
  byStack?: ({ stackBb: number } & Pick<ReraiseSizes, "threeBet" | "fourBetPlus" | "bbOverSb" | "sbOverBb">)[];
}

export interface DepthTuning {
  stackBb: number;
  /** 3-bet width as a share of the opener's: the SB's, and everyone else's. */
  sbThreeBetWidthRatio: number;
  threeBetWidthRatio: number;
  coldCallOopMultiplier: number;
  closingContinueFactor: number;
  /** Share of a 3-bet range that is value, and the share of its flats the SB keeps. */
  threeBetValueShare: number;
  sbFlatFactor: number;
  /** Share of the SB's first-in raises spread over everything it plays instead of its best hands. */
  sbRaiseSpread: number;
  /** Facing a 3-bet over its own first-in raise, the SB keeps this share of what another opener would. */
  sbOpenerKeepFactor: number;
  /** Multiplies the BB's continuing range against the SB's first-in raise: see GameFormat.blindVsBlind. */
  bbVsSbContinueFactor: number;
  /** How much a narrower opener narrows what the BB defends: see FacingRaiseParams.openerWidthExponent. */
  closingWidthExponent: number;
  /** How much of its share an in-position cold caller keeps, and its 3-bet width against a blind's. */
  coldCallIpFactor: number;
  nonBlindThreeBetFactor: number;
  /** How much a narrower opener narrows what a seat that isn't a blind continues with: see GameFormat.coldCallWidthExponent. */
  coldCallWidthExponent: number;
  /** What a seat that isn't a blind keeps per seat behind it: see GameFormat.coldCallPerSeatBehind. */
  coldCallPerSeatBehind: number;
  /** How mixed the 3-bets of a seat that isn't a blind are: see GameFormat.coldCallThreeBetMix. */
  coldCallThreeBetMix: number;
  /** How much of a cold caller's ranking is equity against the opener's range: see GameFormat.coldCallRangeEquityWeight. */
  coldCallRangeEquityWeight: number;
  reraiseKeepBase: number;
  facingFourBetKeepBase: number;
  reraiseRangeEquityWeight: number;
  reraiseValueMixSpread: number;
  /** 0: bluffs from the hands that would fold, as without it. */
  reraiseBlockerBluffMaxShare: number;
  fourBetWidthRatio: number;
  /** 4-betting a 3-bet made in position on hero: see GameFormat.fourBet.vsInPosition. */
  fourBetVsInPositionWidthRatio: number;
  fourBetVsInPositionBluffShare: number;
  /** 5-betting a 4-bet, a seat that isn't a blind: see GameFormat.fiveBet.widthRatio. */
  fiveBetWidthRatio: number;
}

/** The format with its depth tuning applied at this effective stack. Formats without any come back as they are. */
export function tunedAt(format: GameFormat, effectiveStackBb: number): GameFormat {
  if (!format.tuningByStack) return format;
  const { lo, hi, t } = anchorsAround(format.tuningByStack, effectiveStackBb);
  const mix = (key: Exclude<keyof DepthTuning, "stackBb">) => lerp(lo[key], hi[key], t);
  return {
    ...format,
    sbThreeBetWidthRatio: mix("sbThreeBetWidthRatio"),
    threeBetWidthRatio: mix("threeBetWidthRatio"),
    nonBlindThreeBetWidthRatio: mix("threeBetWidthRatio") * mix("nonBlindThreeBetFactor"),
    coldCallOopMultiplier: mix("coldCallOopMultiplier"),
    closingContinueFactor: mix("closingContinueFactor"),
    threeBetValueShare: mix("threeBetValueShare"),
    sbFlatFactor: mix("sbFlatFactor"),
    sbRaiseSpread: mix("sbRaiseSpread"),
    sbOpenerKeepFactor: mix("sbOpenerKeepFactor"),
    blindVsBlind: { continueFactor: mix("bbVsSbContinueFactor"), threeBetWidthRatio: mix("threeBetWidthRatio") },
    closingWidthExponent: mix("closingWidthExponent"),
    coldCallIpFactor: mix("coldCallIpFactor"),
    coldCallWidthExponent: mix("coldCallWidthExponent"),
    coldCallThreeBetMix: mix("coldCallThreeBetMix"),
    coldCallPerSeatBehind: mix("coldCallPerSeatBehind"),
    coldCallRangeEquityWeight: mix("coldCallRangeEquityWeight"),
    reraiseKeepBase: mix("reraiseKeepBase"),
    facingFourBetKeepBase: mix("facingFourBetKeepBase"),
    reraiseRangeEquityWeight: mix("reraiseRangeEquityWeight"),
    reraiseValueMixSpread: mix("reraiseValueMixSpread"),
    reraiseBlockerBluffMaxShare: mix("reraiseBlockerBluffMaxShare") || undefined,
    fourBet: {
      ...format.fourBet,
      widthRatio: mix("fourBetWidthRatio"),
      vsInPosition: { widthRatio: mix("fourBetVsInPositionWidthRatio"), bluffShare: mix("fourBetVsInPositionBluffShare") },
    },
    ...(format.fiveBet && { fiveBet: { ...format.fiveBet, widthRatio: mix("fiveBetWidthRatio") } }),
  };
}

/** A format's 3-bet and 4-bet multiples at this effective stack. */
export function reraiseSizesAt(
  format: GameFormat,
  effectiveStackBb: number,
): Pick<ReraiseSizes, "threeBet" | "fourBetPlus" | "bbOverSb" | "sbOverBb"> {
  if (!format.reraiseSizes.byStack) return format.reraiseSizes;
  const { lo, hi, t } = anchorsAround(format.reraiseSizes.byStack, effectiveStackBb);
  const mix = (a: number, b: number) => lerp(a, b, t);
  const mixOptional = (a: number | undefined, b: number | undefined) => (a === undefined || b === undefined ? undefined : mix(a, b));
  return {
    threeBet: { ip: mix(lo.threeBet.ip, hi.threeBet.ip), sbOop: mix(lo.threeBet.sbOop, hi.threeBet.sbOop), bbOop: mix(lo.threeBet.bbOop, hi.threeBet.bbOop) },
    fourBetPlus: { ip: mix(lo.fourBetPlus.ip, hi.fourBetPlus.ip), oop: mix(lo.fourBetPlus.oop, hi.fourBetPlus.oop) },
    bbOverSb: mixOptional(lo.bbOverSb, hi.bbOverSb),
    sbOverBb: mixOptional(lo.sbOverBb, hi.sbOverBb),
  };
}

export interface FirstInAnchor {
  stackBb: number;
  /** Raise-or-fold open width of each seat, UTG..SB. */
  widths: readonly number[];
  /** With limping on offer: all the SB plays, and the part of it that raises. */
  sbPlay?: number;
  sbRaise?: number;
}

/** The rules and range tuning of one kind of game. */
export interface GameFormat {
  id: GameFormatId;
  label: string;
  /** Seats this table doesn't have. They count as folded from the start, so seat indexes keep meaning distance from the button. */
  absentSeats: readonly Position[];
  /** Single ante the BB posts for the table; 0 when there is none. */
  bbAnteBb: number;
  /** Whether the house takes a cut of each pot, as it does in cash games. */
  allowsRake: boolean;
  /** Whether chips can be priced by what they're worth in prize money, as in a tournament. */
  allowsIcm: boolean;
  /** By seat: UTG to HJ, CO, BTN, SB. */
  openSizes: { oop: OpenSizeRange; ip: OpenSizeRange; btn: OpenSizeRange; sb: OpenSizeRange };
  reraiseSizes: ReraiseSizes;
  sbCanLimp: boolean;
  firstInWidths: readonly FirstInAnchor[];
  threeBetWidthRatio: number;
  /** 3-bet width of a seat that isn't a blind, and of the SB when it differs from the BB's. */
  nonBlindThreeBetWidthRatio: number;
  sbThreeBetWidthRatio?: number;
  coldCallBase: number;
  coldCallOopMultiplier: number;
  /** Flats facing an open someone already called, per caller: in position on hero, and not. */
  overcallFactor: { ipCaller: number; oopCaller: number };
  /** Facing a squeeze, the share kept of what's kept against a plain 3-bet: by the opener, and by a seat that called it. */
  squeezeKeepFactor: { opener: number; caller: number };
  /** A seat whose last action was a call re-raises at most this share of what it keeps. */
  calledReraiseShareCap: number;
  /** Multiplies what a seat closing the action (the BB) continues with against an open. */
  closingContinueFactor: number;
  /** Share of a 3-bet range that is value; default RAISE_VALUE_SHARE. And the share of its flats the SB keeps; default 1. */
  threeBetValueShare?: number;
  sbFlatFactor?: number;
  /** Share of the SB's first-in raises spread over everything it plays; default none, all of them its best hands. */
  sbRaiseSpread?: number;
  /** Facing a 3-bet over its own first-in raise, the SB keeps this share of what another opener would; default 1. */
  sbOpenerKeepFactor?: number;
  /** How much a narrower opener narrows what the BB defends; default 0.5, the square root of its width. */
  closingWidthExponent?: number;
  /** Multiplies an in-position cold caller's share of the BB's continuing range; default 1. */
  coldCallIpFactor?: number;
  /**
   * How much a narrower opener narrows what a seat that isn't a blind
   * continues with, as closingWidthExponent does for the BB; default 0.5.
   */
  coldCallWidthExponent?: number;
  /**
   * How far a seat that isn't a blind moves its 3-bets of an open from its
   * best hands plus suited bluffs (0, the default) to an even slice of
   * everything it continues with (1): see FacingRaiseParams.threeBetMix.
   */
  coldCallThreeBetMix?: number;
  /** A seat that isn't a blind keeps this share of its continuing range for each seat behind it past two; default COLD_CALL_PER_SEAT_BEHIND. */
  coldCallPerSeatBehind?: number;
  /**
   * Facing an open, a seat that isn't a blind ranks its hands with this
   * share of their equity taken against the opener's range rather than a
   * random hand (computeRangePlayabilityRanking); default 0, none.
   */
  coldCallRangeEquityWeight?: number;
  /** Re-raises that would put in at least this share of the stack go all-in instead: over an open, and over a 3-bet or more. */
  jamReraiseShare?: { threeBet: number; fourBet: number };
  /** Tuning that changes with depth, interpolated between these stacks and flat outside them; see tunedAt. */
  tuningByStack?: DepthTuning[];
  /** Whether hands are ranked with bonuses that grow with the stack (playabilityAt); default false, the same ranking at every depth. */
  playabilityByStack?: boolean;
  /** Facing a re-raise with a range of its own, the share of it kept before price and equity move it. */
  reraiseKeepBase: number;
  /** The same facing a 4-bet or more, where the price is better. Default reraiseKeepBase. */
  facingFourBetKeepBase?: number;
  /** How much of the ranking facing a re-raise is equity against the raiser's range, the rest playability. Default 0. */
  reraiseRangeEquityWeight?: number;
  /** Re-raising a 4-bet or more, as a share of the raiser's range, value and bluffs. Default: as fourBet. */
  fiveBet?: {
    widthRatio: number;
    bluffShare: number;
    /** A blind's, whose 3-bets out of position are more polarized. Default widthRatio. */
    blindWidthRatio?: number;
  };
  /** See VsReraiseParams.valueMixSpread. Default 0. */
  reraiseValueMixSpread?: number;
  /** See VsReraiseParams.blockerBluffMaxShare. Default: bluffs from the hands that would fold. */
  reraiseBlockerBluffMaxShare?: number;
  /** Re-raising a re-raise: a share of the raiser's range, part value and part bluff. */
  fourBet: {
    widthRatio: number;
    valueShare: number;
    bluffShare: number;
    /**
     * Against a 3-bet made in position on a seat that isn't a blind: wider, with
     * bluffs. Calling out of position is worth little, so more of what continues
     * 4-bets. Default: as against any other 3-bet.
     */
    vsInPosition?: { widthRatio: number; bluffShare: number };
    /** The SB 4-betting the BB's 3-bet over its own raise. Default: as against any other 3-bet. */
    sbVsBb?: { widthRatio: number; bluffShare: number };
    /** The value share of an opener's 4-bet against a blind's heads-up 3-bet (not a squeeze). Default valueShare. */
    vsBlindValueShare?: number;
  };
  /** The BB against the SB's first-in raise: its continuing range scaled, and its 3-bet width. Default: as against any opener. */
  blindVsBlind?: { continueFactor: number; threeBetWidthRatio: number };
  /** An opener facing the SB's 3-bet keeps this share of what it keeps against another; default 1. */
  sbThreeBetKeepFactor?: number;
  /** The value share of a blind's 3-bet against an open. Default threeBetValueShare. */
  blindThreeBetValueShare?: number;
  /** A blind against an open 3-bets offsuit and low-kicker bluffs, up to this share of each (FacingRaiseParams.blindBluffMaxShare). */
  blindBluffMaxShare?: number;
  /** The BB behind a limp raises its top `valueWidth` and `slice` of every other hand (generateBbVsLimpScenario), from `minStackBb` deep. Unset: value and suited bluffs. */
  bbVsLimpMix?: { valueWidth: number; slice: number; minStackBb?: number };
  /** false: a blind facing a 4-bet out of position 5-bets or folds, never calls. Default true. */
  blindFacingFourBetCalls?: boolean;
  /** The SB's share of those bluffs that stay suited (FacingRaiseParams.blindSuitedBluffShare). */
  sbSuitedBluffShare?: number;
}

/**
 * Tournament tuning by depth, set against the reference solver's MTT 8max ChipEV
 * solutions at 20bb, 40bb and 100bb: 3-bets widen and the SB stops flatting
 * as stacks shorten, the BB defends wider, and facing a 3-bet a seat keeps a
 * different share of its range. 100bb is the old tuning, which already fit.
 *
 * The BB defends an early open less than a button open, but not by the square
 * root of the opener's width (closingWidthExponent), set from the public solver
 * ranges at 20 and 100bb and from their ratios to the button at 40bb, where
 * their bigger opens make the BB defend less across the board.
 *
 * A cold caller in position flats less than the old share, more so the
 * shallower, and 3-bets its own share of the opener's width rather than a
 * blind's (coldCallIpFactor, nonBlindThreeBetFactor: fit to the public ranges'
 * flats and 3-bets at each depth); the SB's out-of-position share, tuned to
 * the reference solver, is left alone.
 *
 * Facing an open, a cold caller that isn't a blind ranks its hands partly by
 * their equity against the opener's range (coldCallRangeEquityWeight): the
 * public ranges' button flats 65s and 86s and folds KTo and QTo against UTG,
 * which a ranking against a random hand gets the other way round. Set to the
 * best hand-by-hand agreement of in-position cold calls with them: at 100bb
 * 70→76%, at 20bb 61→64%; 40bb barely moves.
 *
 * An opener out of position on a 3-bet 4-bets wider, bluffs and all: calling out
 * of position is worth little (the public ranges 4-bet 17–20% of what reached
 * a button 3-bet, against 6–7% of a blind's).
 *
 * The SB's first-in raises are a slice of everything it plays rather than its
 * best hands (raise spread best matching the public solver ranges hand by hand
 * at 20 and 100bb; 40bb, which they don't cover, sits between). At 100bb it
 * continues about half of them against a 3-bet, as a commercial solver's
 * per-hand ranges do (read 2026-11-16); the public ranges fold far more.
 */
const TOURNAMENT_TUNING_BY_STACK: DepthTuning[] = [
  { stackBb: 20, sbThreeBetWidthRatio: 0.62, threeBetWidthRatio: 0.48, coldCallOopMultiplier: 0.55, closingContinueFactor: 1.16, threeBetValueShare: 0.85, sbFlatFactor: 0.1, sbRaiseSpread: 0.5, sbOpenerKeepFactor: 1.3, bbVsSbContinueFactor: 1, closingWidthExponent: 0.1, coldCallIpFactor: 0.6, nonBlindThreeBetFactor: 0.8, coldCallWidthExponent: 0.5, coldCallThreeBetMix: 0.25, coldCallPerSeatBehind: 0.9, coldCallRangeEquityWeight: 0.5, reraiseKeepBase: 0.39, facingFourBetKeepBase: 0.8, reraiseRangeEquityWeight: 0.5, reraiseValueMixSpread: 0.2, reraiseBlockerBluffMaxShare: 0.5, fourBetWidthRatio: 0.65, fourBetVsInPositionWidthRatio: 0.8, fourBetVsInPositionBluffShare: 0.4, fiveBetWidthRatio: 1.2 },
  { stackBb: 30, sbThreeBetWidthRatio: 0.4825, threeBetWidthRatio: 0.4025, coldCallOopMultiplier: 0.525, closingContinueFactor: 1.1, threeBetValueShare: 0.725, sbFlatFactor: 0.55, sbRaiseSpread: 0.55, sbOpenerKeepFactor: 1.35, bbVsSbContinueFactor: 1.095, closingWidthExponent: 0.275, coldCallIpFactor: 0.65, nonBlindThreeBetFactor: 0.775, coldCallWidthExponent: 0.5, coldCallThreeBetMix: 0.625, coldCallPerSeatBehind: 0.9, coldCallRangeEquityWeight: 0.5, reraiseKeepBase: 0.48, facingFourBetKeepBase: 0.8, reraiseRangeEquityWeight: 0.375, reraiseValueMixSpread: 0.1, reraiseBlockerBluffMaxShare: 0.25, fourBetWidthRatio: 0.6, fourBetVsInPositionWidthRatio: 0.8, fourBetVsInPositionBluffShare: 0.4, fiveBetWidthRatio: 1.35 },
  { stackBb: 40, sbThreeBetWidthRatio: 0.345, threeBetWidthRatio: 0.325, coldCallOopMultiplier: 0.5, closingContinueFactor: 1.04, threeBetValueShare: RAISE_VALUE_SHARE, sbFlatFactor: 1, sbRaiseSpread: 0.6, sbOpenerKeepFactor: 1.4, bbVsSbContinueFactor: 1.19, closingWidthExponent: 0.45, coldCallIpFactor: 0.7, nonBlindThreeBetFactor: 0.75, coldCallWidthExponent: 0.5, coldCallThreeBetMix: 1, coldCallPerSeatBehind: 0.9, coldCallRangeEquityWeight: 0.5, reraiseKeepBase: 0.4, facingFourBetKeepBase: 0.8, reraiseRangeEquityWeight: 0.25, reraiseValueMixSpread: 0, reraiseBlockerBluffMaxShare: 0, fourBetWidthRatio: 0.55, fourBetVsInPositionWidthRatio: 0.8, fourBetVsInPositionBluffShare: 0.4, fiveBetWidthRatio: 1.5 },
  { stackBb: 60, sbThreeBetWidthRatio: 0.33, threeBetWidthRatio: 0.3167, coldCallOopMultiplier: 0.5333, closingContinueFactor: 1.0267, threeBetValueShare: 0.6, sbFlatFactor: 1, sbRaiseSpread: 0.65, sbOpenerKeepFactor: 1.3333, bbVsSbContinueFactor: 1.1267, closingWidthExponent: 0.3833, coldCallIpFactor: 0.7333, nonBlindThreeBetFactor: 0.8833, coldCallWidthExponent: 0.4333, coldCallThreeBetMix: 1, coldCallPerSeatBehind: 0.8667, coldCallRangeEquityWeight: 0.5833, reraiseKeepBase: 0.45, facingFourBetKeepBase: 0.75, reraiseRangeEquityWeight: 0.3333, reraiseValueMixSpread: 0.0667, reraiseBlockerBluffMaxShare: 0.1667, fourBetWidthRatio: 0.35, fourBetVsInPositionWidthRatio: 0.7267, fourBetVsInPositionBluffShare: 0.4, fiveBetWidthRatio: 1.1667 },
  { stackBb: 100, sbThreeBetWidthRatio: THREE_BET_WIDTH_RATIO, threeBetWidthRatio: THREE_BET_WIDTH_RATIO, coldCallOopMultiplier: COLD_CALL_OOP_MULTIPLIER, closingContinueFactor: 1, threeBetValueShare: RAISE_VALUE_SHARE, sbFlatFactor: 1, sbRaiseSpread: 0.75, sbOpenerKeepFactor: 1.3, bbVsSbContinueFactor: 1, closingWidthExponent: 0.25, coldCallIpFactor: 0.8, nonBlindThreeBetFactor: 1.15, coldCallWidthExponent: 0.3, coldCallThreeBetMix: 1, coldCallPerSeatBehind: 0.8, coldCallRangeEquityWeight: 0.75, reraiseKeepBase: 0.41, facingFourBetKeepBase: 0.65, reraiseRangeEquityWeight: 0.5, reraiseValueMixSpread: 0.2, reraiseBlockerBluffMaxShare: 0.5, fourBetWidthRatio: 0.38, fourBetVsInPositionWidthRatio: 0.58, fourBetVsInPositionBluffShare: 0.4, fiveBetWidthRatio: 0.5 },
];
/** In tournaments a 3-bet of a quarter of the stack, or a 4-bet of 40% of it, goes all-in, as the reference solver's 20bb and 40bb solutions do. */
const TOURNAMENT_JAM_THREE_BET_SHARE = 0.25;
const TOURNAMENT_JAM_FOUR_BET_SHARE = 0.4;

/**
 * Tournament re-raise sizes by depth, as the reference solver's MTT 8max ChipEV
 * solutions have them (read at 20, 30, 40, 60 and 100bb, 2026-11-17). An
 * in-position 3-bet is 2.25x the open at 20bb, about 2.65x at 30bb, 3x at 40bb,
 * 3.4x at 60bb and 3.8x at 100bb (a little bigger from CO and BTN than from
 * early seats); the SB 3-bets 2.5x–5x and the BB 3x–5.25x. A 4-bet or more is
 * about 2x at 30–60bb and 2.2x (in position) to 2.5x at 100bb; at 20bb that
 * solver only jams, and these 3x/4x sizes reach the jam threshold. Blind
 * against blind, the BB 3-bets the SB's raise 2.25x–3.25x and the SB 4-bets 2–2.5x.
 */
const TOURNAMENT_RERAISE_SIZES_BY_STACK: NonNullable<ReraiseSizes["byStack"]> = [
  { stackBb: 20, threeBet: { ip: 2.25, sbOop: 2.5, bbOop: 3 }, fourBetPlus: { ip: 3, oop: 4 }, bbOverSb: 2.25, sbOverBb: 4 },
  { stackBb: 30, threeBet: { ip: 2.65, sbOop: 3.25, bbOop: 3.75 }, fourBetPlus: { ip: 2, oop: 2 }, bbOverSb: 2.5, sbOverBb: 2 },
  { stackBb: 40, threeBet: { ip: 3, sbOop: 3.75, bbOop: 4.25 }, fourBetPlus: { ip: 2, oop: 2.1 }, bbOverSb: 2.5, sbOverBb: 2.1 },
  { stackBb: 60, threeBet: { ip: 3.4, sbOop: 4, bbOop: 4.75 }, fourBetPlus: { ip: 2, oop: 2.1 }, bbOverSb: 3, sbOverBb: 2.1 },
  { stackBb: 100, threeBet: { ip: 3.8, sbOop: 5, bbOop: 5.25 }, fourBetPlus: { ip: 2.2, oop: 2.5 }, bbOverSb: 3.25, sbOverBb: 2.5 },
];

export const TOURNAMENT_8: GameFormat = {
  id: "tournament-8",
  label: "Tournament 8-max",
  absentSeats: [],
  bbAnteBb: BB_ANTE_BB,
  allowsRake: false,
  allowsIcm: true,
  openSizes: {
    oop: { shallowBb: OPEN_RAISE_EARLY_SHALLOW_BB, deepBb: OPEN_RAISE_EARLY_DEEP_BB },
    ip: { shallowBb: OPEN_RAISE_CO_SHALLOW_BB, deepBb: OPEN_RAISE_CO_DEEP_BB },
    btn: { shallowBb: OPEN_RAISE_BTN_SHALLOW_BB, deepBb: OPEN_RAISE_BTN_DEEP_BB },
    sb: { shallowBb: OPEN_RAISE_SB_SHALLOW_BB, deepBb: OPEN_RAISE_SB_DEEP_BB },
  },
  reraiseSizes: {
    threeBet: { ip: REACTIVE_RAISE_IP_MULTIPLIER, sbOop: REACTIVE_RAISE_OOP_MULTIPLIER, bbOop: REACTIVE_RAISE_OOP_MULTIPLIER },
    fourBetPlus: { ip: REACTIVE_RAISE_IP_MULTIPLIER, oop: REACTIVE_RAISE_OOP_MULTIPLIER },
    byStack: TOURNAMENT_RERAISE_SIZES_BY_STACK,
  },
  sbCanLimp: true,
  firstInWidths: FIRST_IN_WIDTHS_BY_STACK,
  threeBetWidthRatio: THREE_BET_WIDTH_RATIO,
  nonBlindThreeBetWidthRatio: THREE_BET_WIDTH_RATIO,
  coldCallBase: COLD_CALL_BASE,
  coldCallOopMultiplier: COLD_CALL_OOP_MULTIPLIER,
  overcallFactor: { ipCaller: 1, oopCaller: 1 },
  squeezeKeepFactor: { opener: 1, caller: 1 },
  calledReraiseShareCap: RERAISE_MAX_SHARE_OF_KEPT,
  closingContinueFactor: 1,
  jamReraiseShare: { threeBet: TOURNAMENT_JAM_THREE_BET_SHARE, fourBet: TOURNAMENT_JAM_FOUR_BET_SHARE },
  tuningByStack: TOURNAMENT_TUNING_BY_STACK,
  playabilityByStack: true,
  reraiseKeepBase: RERAISE_KEEP_BASE,
  fourBet: { widthRatio: THREE_BET_WIDTH_RATIO, valueShare: RAISE_VALUE_SHARE, bluffShare: 0 },
  fiveBet: { widthRatio: 0.5, bluffShare: 0, blindWidthRatio: 2 },
  // Measured at 100, 40 and 20bb; push/fold takes over below 15bb.
  bbVsLimpMix: { valueWidth: 0.15, slice: 0.35, minStackBb: 15 },
};

const CASH_OPEN: OpenSizeRange = { shallowBb: CASH_OPEN_RAISE_BB, deepBb: CASH_OPEN_RAISE_BB };

const CASH_8: GameFormat = {
  id: "cash-8",
  label: "Cash 8-max",
  absentSeats: [],
  bbAnteBb: 0,
  allowsRake: true,
  allowsIcm: false,
  openSizes: {
    oop: CASH_OPEN,
    ip: CASH_OPEN,
    btn: CASH_OPEN,
    sb: { shallowBb: CASH_SB_OPEN_RAISE_BB, deepBb: CASH_SB_OPEN_RAISE_BB },
  },
  reraiseSizes: {
    threeBet: { ip: CASH_THREE_BET_IP_MULTIPLIER, sbOop: CASH_THREE_BET_SB_MULTIPLIER, bbOop: CASH_THREE_BET_BB_MULTIPLIER },
    fourBetPlus: { ip: CASH_FOUR_BET_IP_MULTIPLIER, oop: CASH_FOUR_BET_OOP_MULTIPLIER },
    squeeze: { blind: CASH_SQUEEZE_BLIND_MULTIPLIER, perCaller: CASH_SQUEEZE_PER_CALLER },
    bbOverSb: CASH_THREE_BET_BB_OVER_SB_MULTIPLIER,
  },
  sbCanLimp: true,
  firstInWidths: CASH_FIRST_IN_WIDTHS,
  threeBetWidthRatio: CASH_THREE_BET_WIDTH_RATIO,
  nonBlindThreeBetWidthRatio: CASH_NON_BLIND_THREE_BET_WIDTH_RATIO,
  coldCallBase: CASH_COLD_CALL_BASE,
  coldCallOopMultiplier: CASH_COLD_CALL_OOP_MULTIPLIER,
  overcallFactor: { ipCaller: CASH_OVERCALL_FACTOR_IP_CALLER, oopCaller: CASH_OVERCALL_FACTOR_OOP_CALLER },
  squeezeKeepFactor: { opener: CASH_SQUEEZE_KEEP_FACTOR, caller: CASH_CALLER_SQUEEZE_KEEP_FACTOR },
  calledReraiseShareCap: CASH_CALLED_RERAISE_SHARE_CAP,
  closingContinueFactor: 1,
  closingWidthExponent: CASH_CLOSING_WIDTH_EXPONENT,
  reraiseKeepBase: CASH_RERAISE_KEEP_BASE,
  fourBet: {
    widthRatio: CASH_FOUR_BET_WIDTH_RATIO,
    valueShare: RAISE_VALUE_SHARE,
    bluffShare: CASH_FOUR_BET_BLUFF_SHARE,
    vsInPosition: { widthRatio: CASH_FOUR_BET_VS_IN_POSITION_WIDTH_RATIO, bluffShare: CASH_FOUR_BET_BLUFF_SHARE },
    sbVsBb: { widthRatio: CASH_SB_FOUR_BET_WIDTH_RATIO, bluffShare: CASH_SB_FOUR_BET_BLUFF_SHARE },
  },
  blindVsBlind: { continueFactor: CASH_BB_VS_SB_CONTINUE_FACTOR, threeBetWidthRatio: CASH_BB_VS_SB_THREE_BET_WIDTH_RATIO },
  sbThreeBetKeepFactor: CASH_SB_THREE_BET_KEEP_FACTOR,
  blindBluffMaxShare: 0.8,
  sbSuitedBluffShare: 0.5,
  bbVsLimpMix: { valueWidth: 0.12, slice: 0.32 },
  reraiseRangeEquityWeight: 1,
  reraiseValueMixSpread: 0.2,
  reraiseBlockerBluffMaxShare: 0.1,
  // A commercial solver's 8-max 100bb (no rake and live 10%, read 2026-11-17):
  // a blind facing a 4-bet continues about two-thirds of its 3-bets, calling
  // about as often as it 5-bets.
  facingFourBetKeepBase: 0.55,
  fiveBet: { widthRatio: 1.1, bluffShare: 0, blindWidthRatio: 1 },
};

/**
 * The same solver's 6-max NL10 tree differs at the 4-bet: a blind facing one
 * jams or folds, about 40% of its 3-bets jamming (read 2026-11-16).
 */
const CASH_6: GameFormat = {
  ...CASH_8,
  id: "cash-6",
  label: "Cash 6-max",
  absentSeats: ["UTG", "UTG1"],
  facingFourBetKeepBase: 0.4,
  fiveBet: { widthRatio: 1.1, bluffShare: 0, blindWidthRatio: 2.5 },
  blindFacingFourBetCalls: false,
  // In the same tree a blind 3-bets a more polar range, flatting 88–99 and
  // AJs–A9s, and the opener 4-bets it with fewer value hands, flatting 99–77
  // and the suited broadways. On 19 flops of BTN against a BB 3-bet (read
  // 2026-11-17), with our own ranges, the BB's c-bet frequency gap fell
  // 33.0→27.0pp and hand agreement rose 64.2→68.6%; single-raised flops went
  // 80.8→82.8%, preflop 89.2→89.3%.
  blindThreeBetValueShare: 0.45,
  fourBet: { ...CASH_8.fourBet, vsBlindValueShare: 0.45 },
};

export const GAME_FORMATS: GameFormat[] = [TOURNAMENT_8, CASH_6, CASH_8];

/** A format's open widths under this rake. Formats without rake keep theirs. */
export function firstInWidthsUnder(format: GameFormat, rake: RakeSettings): readonly FirstInAnchor[] {
  if (!format.allowsRake) return format.firstInWidths;
  const drawnAt = rakeShare(DEFAULT_RAKE_SETTINGS.structure);
  const stealCost = rake.noFlopNoDrop ? 0 : rake.structure.rate;
  const factor = (1 - RAKE_OPEN_SENSITIVITY * (rakeShare(rake.structure) - drawnAt)) * (1 - stealCost);
  const scale = (width: number | undefined) => (width === undefined ? undefined : width * factor);
  return format.firstInWidths.map((anchor) => ({
    ...anchor,
    widths: anchor.widths.map((width) => width * factor),
    sbPlay: scale(anchor.sbPlay),
    sbRaise: scale(anchor.sbRaise),
  }));
}

export function gameFormatById(id: string): GameFormat | undefined {
  return GAME_FORMATS.find((format) => format.id === id);
}
