import { describe, expect, it } from "vitest";
import { equityAtShare, equityDistribution, equityRealization, handValues, valueColor, VALUE_RAMP } from "./handValues";
import type { SerializedCombo, SerializedDecisionNode } from "@/types/postflopSolver";

const range: SerializedCombo[] = [
  { cards: ["Ah", "Kh"], weight: 1 },
  { cards: ["Ad", "Kd"], weight: 3 },
  { cards: ["7c", "7d"], weight: 2 },
  { cards: ["2c", "3c"], weight: 0 },
];
const node: SerializedDecisionNode = {
  type: "decision",
  actor: "P1",
  potBb: 10,
  currentBetToCall: 0,
  actions: [],
  strategy: [],
  comboValues: {
    ev: { P1: [8, 4, 2, NaN], P2: [] },
    equity: { P1: [0.9, 0.5, 0.3, NaN], P2: [] },
  },
};

describe("handValues", () => {
  it("averages a hand's combos by their weight here, and leaves out hands that don't reach", () => {
    const values = handValues(node, "P1", range);
    expect(values.get("AKs")!.ev).toBeCloseTo((8 + 3 * 4) / 4);
    expect(values.get("AKs")!.equity).toBeCloseTo((0.9 + 3 * 0.5) / 4);
    expect(values.get("77")!.equity).toBe(0.3);
    expect(values.has("32s")).toBe(false);
  });
});

describe("equityRealization", () => {
  it("is EV over equity × pot, and undefined with no equity to realize", () => {
    expect(equityRealization({ ev: 6, equity: 0.5 }, 10)).toBeCloseTo(1.2);
    expect(equityRealization({ ev: 0, equity: 0 }, 10)).toBeUndefined();
  });
});

describe("equityDistribution", () => {
  it("sorts the range best first, by share of its weight", () => {
    const curve = equityDistribution(node, "P1", range);
    expect(curve.map((p) => p.equity)).toEqual([0.9, 0.5, 0.3]);
    expect(curve.map((p) => p.share)).toEqual([1 / 6, 4 / 6, 1]);
    expect(equityAtShare(curve, 0.1)).toBe(0.9);
    expect(equityAtShare(curve, 0.5)).toBe(0.5);
  });
});

describe("valueColor", () => {
  it("runs from the ramp's dark end to its light end, clamped", () => {
    expect(valueColor(0, [0, 1])).toBe(VALUE_RAMP[0]);
    expect(valueColor(5, [0, 1])).toBe(VALUE_RAMP[VALUE_RAMP.length - 1]);
    expect(valueColor(-1, [0, 1])).toBe(VALUE_RAMP[0]);
  });
});
