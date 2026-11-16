import { RANKS, type Rank } from "@/lib/cards";
import type { HandFrequency } from "@/types/rangeData";
import type { ActionWeightKey } from "@/types/postflopSolver";
import { ALL_HANDS, HAND_BY_LABEL, TOTAL_COMBOS } from "./handList";

/** Each hand's share in the range, 0..1; a hand left out is 0. */
export type RangeWeights = ReadonlyMap<string, number>;

export type RangeTextError =
  /** Not a hand, a range of hands, or a weight this reads. */
  | "unknown"
  /** A single combo such as AhKh: the solver takes hands, not combos. */
  | "combo"
  /** A weight outside 0..1 (or 0..100%). */
  | "weight"
  /** Nothing in the range. */
  | "empty";

export type RangeTextResult = { ok: true; weights: Map<string, number> } | { ok: false; error: RangeTextError; token: string };

type Suffix = "s" | "o" | "";

const rankIndex = (r: string) => RANKS.indexOf(r as Rank);

function handLabel(high: number, low: number, suffix: "s" | "o" | "pair"): string {
  return suffix === "pair" ? `${RANKS[high]}${RANKS[high]}` : `${RANKS[high]}${RANKS[low]}${suffix}`;
}

/** The labels a two-rank shape names: a pair, or a suited and/or offsuit hand. */
function labelsOf(high: number, low: number, suffix: Suffix): string[] {
  if (high === low) return suffix === "" ? [handLabel(high, high, "pair")] : [];
  if (suffix === "") return [handLabel(high, low, "s"), handLabel(high, low, "o")];
  return [handLabel(high, low, suffix)];
}

interface Shape {
  high: number;
  low: number;
  suffix: Suffix;
}

function parseShape(text: string): Shape | null {
  const m = /^([AKQJT2-9])([AKQJT2-9])([so]?)$/.exec(text);
  if (!m) return null;
  let high = rankIndex(m[1]);
  let low = rankIndex(m[2]);
  if (high > low) [high, low] = [low, high];
  const suffix = m[3] as Suffix;
  if (high === low && suffix !== "") return null;
  return { high, low, suffix };
}

/** Ranks upper-cased, the s/o suffix lower-cased: "aks" and "AKS" both read as AKs. */
function normalize(text: string): string {
  return text.replace(/^([a-z0-9]{2})/i, (r) => r.toUpperCase()).replace(/([so])$/i, (s) => s.toLowerCase());
}

/** The hands one token without its weight names, or null if it names none. */
function expandToken(token: string): string[] | null {
  if (token.endsWith("+")) {
    const shape = parseShape(normalize(token.slice(0, -1)));
    if (!shape) return null;
    const labels: string[] = [];
    // 77+ is 77 up to AA; ATs+ is ATs up to AKs.
    if (shape.high === shape.low) for (let r = shape.high; r >= 0; r--) labels.push(...labelsOf(r, r, ""));
    else for (let low = shape.low; low > shape.high; low--) labels.push(...labelsOf(shape.high, low, shape.suffix));
    return labels;
  }
  const dash = token.split("-");
  if (dash.length === 2) {
    const a = parseShape(normalize(dash[0]));
    const b = parseShape(normalize(dash[1]));
    if (!a || !b || a.suffix !== b.suffix) return null;
    const labels: string[] = [];
    if (a.high === a.low && b.high === b.low) {
      // 99-66
      for (let r = Math.min(a.high, b.high); r <= Math.max(a.high, b.high); r++) labels.push(...labelsOf(r, r, ""));
    } else if (a.high === b.high && a.high !== a.low && b.high !== b.low) {
      // K9s-K6s
      for (let low = Math.min(a.low, b.low); low <= Math.max(a.low, b.low); low++) labels.push(...labelsOf(a.high, low, a.suffix));
    } else if (a.low - a.high === b.low - b.high && a.high !== a.low) {
      // T9s-65s: the same gap, moved down the deck.
      const gap = a.low - a.high;
      for (let high = Math.min(a.high, b.high); high <= Math.max(a.high, b.high); high++) labels.push(...labelsOf(high, high + gap, a.suffix));
    } else return null;
    return labels;
  }
  const shape = parseShape(normalize(token));
  return shape ? labelsOf(shape.high, shape.low, shape.suffix) : null;
}

function parseWeight(text: string): number | null {
  const percent = text.endsWith("%");
  const number = Number(percent ? text.slice(0, -1) : text);
  if (text === "" || text === "%" || !Number.isFinite(number)) return null;
  const weight = percent ? number / 100 : number;
  return weight >= 0 && weight <= 1 ? weight : null;
}

const COMBO = /^[AKQJT2-9][shdc][AKQJT2-9][shdc]$/i;

/**
 * Reads a range as solvers and range tools write it: hands (AA, AKs, AKo, AK
 * for both), ranges of them (22+, ATs+, 99-66, K9s-K6s, T9s-65s), each with an
 * optional weight (AKs:0.5 or AKs:50%), apart by commas, spaces or new lines.
 * A hand named twice keeps the later weight.
 */
export function parseRangeText(text: string): RangeTextResult {
  const weights = new Map<string, number>();
  const tokens = text.replace(/\s*:\s*/g, ":").split(/[\s,;]+/).filter(Boolean);
  for (const token of tokens) {
    const [hands, weightText, ...rest] = token.split(":");
    if (rest.length > 0) return { ok: false, error: "unknown", token };
    if (COMBO.test(hands)) return { ok: false, error: "combo", token };
    const labels = expandToken(hands);
    if (!labels) return { ok: false, error: "unknown", token };
    const weight = weightText === undefined ? 1 : parseWeight(weightText);
    if (weight === null) return { ok: false, error: "weight", token };
    for (const label of labels) weights.set(label, weight);
  }
  for (const [label, weight] of weights) if (weight === 0) weights.delete(label);
  if (weights.size === 0) return { ok: false, error: "empty", token: "" };
  return { ok: true, weights };
}

const round = (w: number) => Math.round(w * 100) / 100;

/**
 * Writes a range back as text parseRangeText reads: runs of hands all in the
 * range as 22+, ATs+, 99-66 or K9s-K6s, the rest one by one with a weight to
 * two decimals. Pairs first, then suited, then offsuit, high cards first.
 */
export function formatRangeText(weights: RangeWeights): string {
  const parts: string[] = [];
  const full = (label: string) => round(weights.get(label) ?? 0) === 1;
  // A run from the top of its row is "77+" or "ATs+"; one further down, "99-66" or "K9s-K6s".
  const flushRun = (run: string[], fromTop: boolean) => {
    if (run.length === 1) parts.push(run[0]);
    else if (run.length > 1) parts.push(fromTop ? `${run[run.length - 1]}+` : `${run[0]}-${run[run.length - 1]}`);
  };
  const weighted = (label: string) => {
    const w = round(weights.get(label) ?? 0);
    if (w > 0 && w < 1) parts.push(`${label}:${w}`);
  };

  const pairs = RANKS.map((_, r) => handLabel(r, r, "pair"));
  writeRuns(pairs, full, flushRun, weighted);
  for (const suffix of ["s", "o"] as const) {
    for (let high = 0; high < RANKS.length - 1; high++) {
      const row: string[] = [];
      for (let low = high + 1; low < RANKS.length; low++) row.push(handLabel(high, low, suffix));
      writeRuns(row, full, flushRun, weighted);
    }
  }
  return parts.join(",");
}

/** Walks a row best hand first, writing each run of full hands, and the weighted ones as they come. */
function writeRuns(row: string[], full: (label: string) => boolean, flushRun: (run: string[], topOfRun: boolean) => void, weighted: (label: string) => void) {
  let run: string[] = [];
  let runStart = 0;
  row.forEach((label, i) => {
    if (full(label)) {
      if (run.length === 0) runStart = i;
      run.push(label);
      return;
    }
    flushRun(run, runStart === 0);
    run = [];
    weighted(label);
  });
  flushRun(run, runStart === 0);
}

/** How many of the 1326 combos the range holds, weighted. */
export function rangeCombos(weights: RangeWeights): number {
  let combos = 0;
  for (const [label, weight] of weights) combos += (HAND_BY_LABEL.get(label)?.combos ?? 0) * weight;
  return combos;
}

export function rangeShare(weights: RangeWeights): number {
  return rangeCombos(weights) / TOTAL_COMBOS;
}

/** A chart's range for one action: each hand's frequency of it. */
export function weightsOfHands(hands: readonly HandFrequency[], actionKey: ActionWeightKey): Map<string, number> {
  return new Map(hands.filter((hf) => (hf[actionKey] ?? 0) > 0).map((hf) => [hf.hand, hf[actionKey] ?? 0]));
}

/** A range as chart rows for the solver: every hand "calls" its weight and folds the rest. */
export function handsOfWeights(weights: RangeWeights): HandFrequency[] {
  return ALL_HANDS.map(({ hand }) => {
    const w = weights.get(hand) ?? 0;
    return { hand, fold: 1 - w, call: w, raise: 0 };
  });
}
