import type { DecisionNode } from "./treeBuilder";
import type { ExploitabilityResult } from "./exploitability";

export interface CfrSolution {
  iterations: number;
  /** [comboIndex][actionIndex], normalized. `combos`/`actionLabels` on the node itself give you what each index means. */
  getAverageStrategy(node: DecisionNode): number[][];
  /** Set only when the early-stop check measured it at exactly `iterations` — i.e. it already describes this final strategy, so callers needn't recompute it. */
  finalExploitability?: ExploitabilityResult;
}

/**
 * See the Phase B-2 plan doc for the reasoning behind these defaults —
 * revisit once real wide-range (100bb, 130-190 combo/side) telemetry is
 * collected. Phase B-3 switched the underlying algorithm from CFR+ to DCFR,
 * which converges faster in practice — this hasn't been lowered pending
 * that same telemetry, since the early-stop mechanism already captures the
 * speedup without needing to touch the safety ceiling.
 */
export const DEFAULT_MAX_CFR_ITERATIONS = 20000;
/** Percent of pot. Loose end of TexasSolver's cited 0.275-0.5% range — this phase targets UX (not maximal precision). */
export const DEFAULT_TARGET_EXPLOITABILITY_PERCENT = 0.5;

/**
 * A 3-bet pot's flop — a pot of at least LOW_SPR_FLOP_MIN_POT_BB with at most
 * LOW_SPR_FLOP_MAX_SPR times it behind — is solved to this instead. Its tree is
 * small, so the tighter target is cheap, and at 0.5% the out-of-position caller
 * still donks hands it should check: on 18 cash 6-max 3-bet flops with a
 * commercial solver's ranges (2026-11-21, Node 10 threads) where that solver
 * donks at most 6%, the donk share fell 23→14% at 0.1% for 1.47→3.30s a board.
 * A single-raised pot keeps the default: 100bb cash took 8.8→20.0s, and a
 * 30bb tournament one, whose SPR is as low, 7.7→14.6s.
 */
export const LOW_SPR_TARGET_EXPLOITABILITY_PERCENT = 0.1;
export const LOW_SPR_FLOP_MAX_SPR = 6;
/** Single-raised pots start at 5.5–6.5bb; 3-bet pots at 14bb or more. */
export const LOW_SPR_FLOP_MIN_POT_BB = 10;

/** The exploitability target for a flop starting from this pot and stack. */
export function flopTargetExploitabilityPercent(startPotBb: number, effectiveStackBb: number): number {
  const threeBetPot = startPotBb >= LOW_SPR_FLOP_MIN_POT_BB && effectiveStackBb / startPotBb <= LOW_SPR_FLOP_MAX_SPR;
  return threeBetPot ? LOW_SPR_TARGET_EXPLOITABILITY_PERCENT : DEFAULT_TARGET_EXPLOITABILITY_PERCENT;
}

export const DEFAULT_EXPLOITABILITY_CHECK_START_INTERVAL = 100;
const EXPLOITABILITY_CHECK_INTERVAL_CEILING = 2000;
/**
 * Each check costs about 3 iterations, and a solve overshoots its true
 * convergence point by up to one gap. Gaps 10% of the iteration count keep
 * both small (bench:postflop: a 3-bet pot stops at 509 iterations instead of
 * 800 with doubling gaps, against a true crossing near 550).
 */
const EXPLOITABILITY_CHECK_GROWTH = 1.1;

/** When to measure next after a check at iteration `t` (wasm/engine.ts). */
export function nextExploitabilityCheck(t: number): number {
  return t + Math.min(Math.max(1, Math.round(t * (EXPLOITABILITY_CHECK_GROWTH - 1))), EXPLOITABILITY_CHECK_INTERVAL_CEILING);
}

export interface CfrRunOptions {
  /** Hard safety cap — CFR always stops here even if the target was never reached. */
  maxIterations: number;
  /** Stop early once a periodic exploitability check reads at or below this (% of pot). Omit to disable early stopping entirely and always run exactly maxIterations. */
  targetExploitabilityPercent?: number;
  /** Iteration count of the first periodic exploitability check; after that each gap is EXPLOITABILITY_CHECK_GROWTH − 1 of the iteration count, capped at EXPLOITABILITY_CHECK_INTERVAL_CEILING. Default 100. */
  checkIntervalIterations?: number;
}
