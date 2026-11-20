export const SMALL_BLIND_BB = 0.5;
export const BIG_BLIND_BB = 1;
/** Single BB-posted ante covering the whole table (the modern MTT convention). */
export const BB_ANTE_BB = 1;

/** At 1bb an all-in only matches the big blind: no raise, so no seat could ever call it or close the action. */
export const STACK_MIN_BB = 2;
export const STACK_MAX_BB = 100;

/**
 * Always route to the Nash push/fold solver at or under this effective stack. At 15bb a commercial
 * solver's MTT tree still min-raises most opens (read 2026-11-20), and the depth-tuned heuristic
 * matched it at 93.9% line-weighted agreement where push/fold matched 86.7%.
 */
export const NASH_FLAT_STACK_THRESHOLD_BB = 14;
/** Route to Nash when facing a raise and remaining-stack/pot is at or under this ratio. */
export const NASH_SPR_THRESHOLD = 1;
/**
 * Facing such a raise when it isn't all-in, the share of the continuing hands
 * that move all-in rather than call. A commercial solver's 30bb tournament
 * spots (read 2026-11-17) jam 53–95% of what continues against a 4-bet, about 70% typically.
 */
export const SHORT_RERAISE_JAM_SHARE = 0.7;

/**
 * Opening raise-to size (bb) scales linearly with effective stack depth:
 * flat at/below OPEN_RAISE_SCALING_MIN_STACK_BB, reaching its deepest value
 * at STACK_MAX_BB (the app's max supported depth). Set to the reference solver's MTT
 * 8max ChipEV solutions: 2bb from every seat at 40bb and below (3bb from the
 * SB), and at 100bb 2.1bb from UTG to HJ, 2.2bb from CO, 2.5bb from BTN and
 * 3.5bb from the SB.
 */
export const OPEN_RAISE_SCALING_MIN_STACK_BB = 40;
export const OPEN_RAISE_EARLY_SHALLOW_BB = 2.0; // UTG, UTG1, LJ, HJ
export const OPEN_RAISE_EARLY_DEEP_BB = 2.1;
export const OPEN_RAISE_CO_SHALLOW_BB = 2.0;
export const OPEN_RAISE_CO_DEEP_BB = 2.2;
export const OPEN_RAISE_BTN_SHALLOW_BB = 2.0;
export const OPEN_RAISE_BTN_DEEP_BB = 2.5;
export const OPEN_RAISE_SB_SHALLOW_BB = 3.0;
export const OPEN_RAISE_SB_DEEP_BB = 3.5;

/** Cash opens one size from every seat, a little bigger from the SB, which plays the pot out of position. */
export const CASH_OPEN_RAISE_BB = 2.5;
export const CASH_SB_OPEN_RAISE_BB = 3.5;

/** BB's raise-to size over a limp. */
export const LIMP_RAISE_TO_BB = 3.5;

/** Reactive raise-to size, as a multiple of the previous aggressor's raise-to amount. */
export const REACTIVE_RAISE_IP_MULTIPLIER = 3; // raiser acts after the last aggressor postflop
export const REACTIVE_RAISE_OOP_MULTIPLIER = 4; // raiser acts before the last aggressor postflop

/**
 * Cash re-raise sizes, as the reference solver's 6max NL10 100bb solution uses them:
 * the button 3-bets a cutoff or UTG open to 8bb, the SB a button open to 11bb
 * and the BB to 13.5bb; the button 4-bets a BB 3-bet to 28.5bb, and UTG a
 * button 3-bet to 21.5bb.
 */
export const CASH_THREE_BET_IP_MULTIPLIER = 3.2;
export const CASH_THREE_BET_SB_MULTIPLIER = 4.4;
export const CASH_THREE_BET_BB_MULTIPLIER = 5.4;
export const CASH_THREE_BET_BB_OVER_SB_MULTIPLIER = 3; // reference NL10: 10.5 over the SB's 3.5
export const CASH_FOUR_BET_IP_MULTIPLIER = 2.11;
export const CASH_FOUR_BET_OOP_MULTIPLIER = 2.69;
/** Either blind squeezes a cutoff open and button call to 14bb there; further callers and in-position squeezes are estimates. */
export const CASH_SQUEEZE_BLIND_MULTIPLIER = 5.6;
export const CASH_SQUEEZE_PER_CALLER = 1;
