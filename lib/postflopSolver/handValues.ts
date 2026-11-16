import { canonicalHandOf } from "./canonicalHand";
import type { PostflopPlayer } from "./potState";
import type { SerializedCombo, SerializedDecisionNode } from "@/types/postflopSolver";

/** What the range grid shows: the strategy, or one of each hand's values. */
export type RangeView = "strategy" | "ev" | "equity" | "eqr";
export type ValueView = Exclude<RangeView, "strategy">;

export interface ComboValue {
  /** bb still to collect from here (comboValues.ts). */
  ev: number;
  /** 0–1 against the opponent's range here. */
  equity: number;
}

/**
 * Equity realization: the share of its equity's worth in the pot a hand
 * actually expects to collect. Undefined for a hand with (almost) no equity,
 * whose ratio means nothing.
 */
export function equityRealization(value: ComboValue, potBb: number): number | undefined {
  const fair = value.equity * potBb;
  return fair > potBb * 0.01 ? value.ev / fair : undefined;
}

export function valueOf(value: ComboValue, view: ValueView, potBb: number): number | undefined {
  if (view === "ev") return value.ev;
  if (view === "equity") return value.equity;
  return equityRealization(value, potBb);
}

/** One combo's values at `node` for `player`, or undefined when it doesn't reach the node or the tree carries none. */
export function comboValueAt(node: SerializedDecisionNode, player: PostflopPlayer, index: number): ComboValue | undefined {
  const values = node.comboValues;
  if (!values) return undefined;
  const equity = values.equity[player][index];
  // EV alone can be NaN (no opponent hand reaches with these cards out); equity then is the 0.5 of an empty range.
  if (!Number.isFinite(equity)) return undefined;
  return { ev: values.ev[player][index], equity };
}

/** Each 169-grid hand's values, averaged over its combos by how often each reaches here. */
export function handValues(node: SerializedDecisionNode, player: PostflopPlayer, range: SerializedCombo[]): Map<string, ComboValue> {
  const sums = new Map<string, { weight: number; ev: number; evWeight: number; equity: number }>();
  range.forEach((combo, i) => {
    if (combo.weight <= 0) return;
    const value = comboValueAt(node, player, i);
    if (!value) return;
    const hand = canonicalHandOf(combo.cards);
    const sum = sums.get(hand) ?? { weight: 0, ev: 0, evWeight: 0, equity: 0 };
    sum.weight += combo.weight;
    sum.equity += combo.weight * value.equity;
    if (Number.isFinite(value.ev)) {
      sum.ev += combo.weight * value.ev;
      sum.evWeight += combo.weight;
    }
    sums.set(hand, sum);
  });
  const result = new Map<string, ComboValue>();
  for (const [hand, s] of sums) result.set(hand, { ev: s.evWeight > 0 ? s.ev / s.evWeight : NaN, equity: s.equity / s.weight });
  return result;
}

/**
 * A range's equity distribution: its combos sorted by equity, best first,
 * as (share of the range at or above, equity) steps — the curve solvers draw.
 */
export function equityDistribution(node: SerializedDecisionNode, player: PostflopPlayer, range: SerializedCombo[]): { share: number; equity: number }[] {
  const points = range
    .map((combo, i) => ({ weight: combo.weight, value: combo.weight > 0 ? comboValueAt(node, player, i) : undefined }))
    .filter((p): p is { weight: number; value: ComboValue } => p.value !== undefined)
    .sort((a, b) => b.value.equity - a.value.equity);
  const total = points.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return [];
  let seen = 0;
  return points.map((p) => {
    seen += p.weight;
    return { share: seen / total, equity: p.value.equity };
  });
}

/** The equity a share (0–1) of the range, from its best hand down, has at least. */
export function equityAtShare(curve: { share: number; equity: number }[], share: number): number | undefined {
  if (curve.length === 0) return undefined;
  return (curve.find((p) => p.share >= share) ?? curve[curve.length - 1]).equity;
}

/** Each view's color scale range. EV runs up to the pot: a hand that wins it every time. */
export function valueScale(view: ValueView, potBb: number): [number, number] {
  if (view === "ev") return [0, potBb];
  if (view === "equity") return [0, 1];
  return [0, 1.5];
}

/** Dark-surface sequential blue, dark (low) to light (high). */
export const VALUE_RAMP = ["#0d366b", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A value's color on VALUE_RAMP, clamped to the scale. */
export function valueColor(value: number, [low, high]: [number, number]): string {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low))) * (VALUE_RAMP.length - 1);
  const i = Math.min(VALUE_RAMP.length - 2, Math.floor(t));
  const f = t - i;
  const a = hexToRgb(VALUE_RAMP[i]);
  const b = hexToRgb(VALUE_RAMP[i + 1]);
  const mix = a.map((x, k) => Math.round(x + (b[k] - x) * f));
  return `#${mix.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** A value as the grid and the combo list print it. */
export function formatValue(value: number, view: ValueView): string {
  if (view === "ev") return value.toFixed(value >= 10 || value <= -10 ? 1 : 2);
  return `${Math.round(value * 100)}`;
}
