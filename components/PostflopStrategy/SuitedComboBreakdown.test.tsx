import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SuitedComboBreakdown } from "./SuitedComboBreakdown";
import { buildActionColorScale } from "./postflopColorLegend";
import type { SerializedCombo, SerializedDecisionNode } from "@/types/postflopSolver";

function terminal(potBb: number): SerializedDecisionNode["actions"][number]["child"] {
  return { type: "terminal-showdown", potBb, committed: { P1: 0, P2: 0 } };
}

const node: SerializedDecisionNode = {
  type: "decision",
  actor: "P1",
  potBb: 10,
  currentBetToCall: 0,
  actions: [
    { action: "check", label: "Check", child: terminal(10) },
    { action: "bet", label: "Bet 5bb", child: terminal(15) },
  ],
  // AhKh at index 0, AdKd at index 1 — AcKc deliberately absent (not in range).
  strategy: [
    [0.3, 0.7],
    [0.9, 0.1],
  ],
};
const range: SerializedCombo[] = [
  { cards: ["Ah", "Kh"], weight: 1 },
  { cards: ["Ad", "Kd"], weight: 1 },
];

describe("SuitedComboBreakdown", () => {
  it("shows a placeholder when no hand is selected", () => {
    render(
      <SuitedComboBreakdown
        selectedHand={null}
        node={node}
        range={range}
        board={["2c", "7d", "9s"]}
        colors={buildActionColorScale(node.actions)}
        heroLabel="BTN"
        villainLabel="BB"
      />,
    );
    expect(screen.getByText(/Select a hand/)).toBeInTheDocument();
  });

  it("shows a blocked message when every combo of the hand is dead on this board", () => {
    // AA's 6 combos all use an ace; blocking every ace-containing card except leaves none live is
    // impractical with 4 board cards, so use a suited hand fully covered by the board's suits instead:
    // board holds As, Ah, Ad, Ac -> every AKs combo (all 4 suits) is blocked.
    render(
      <SuitedComboBreakdown
        selectedHand="AKs"
        node={node}
        range={range}
        board={["As", "Ah", "Ad", "Ac"]}
        colors={buildActionColorScale(node.actions)}
        heroLabel="BTN"
        villainLabel="BB"
      />,
    );
    expect(screen.getByText(/blocked by the board/)).toBeInTheDocument();
  });

  it("lists each live combo, distinguishing in-range from not-in-range", () => {
    // Board blocks only AsKs; AhKh/AdKd/AcKc stay live. Range only has AhKh and AdKd.
    render(
      <SuitedComboBreakdown
        selectedHand="AKs"
        node={node}
        range={range}
        board={["As", "2c", "7d"]}
        colors={buildActionColorScale(node.actions)}
        heroLabel="BTN"
        villainLabel="BB"
      />,
    );
    const rows = screen.getAllByTestId("suited-combo-row");
    expect(rows).toHaveLength(3); // AhKh, AdKd, AcKc all live

    const notInRangeRows = rows.filter((r) => r.textContent?.includes("Not in"));
    expect(notInRangeRows).toHaveLength(1); // only AcKc

    expect(screen.getByText(/Check 30.0%/)).toBeInTheDocument();
    expect(screen.getByText(/Bet 5bb 70.0%/)).toBeInTheDocument();
    expect(screen.getByText(/Check 90.0%/)).toBeInTheDocument();
    expect(screen.getByText(/Bet 5bb 10.0%/)).toBeInTheDocument();
  });
});

describe("SuitedComboBreakdown values", () => {
  it("shows each combo's EV, equity and EQR when the solve carries them", () => {
    const withValues: SerializedDecisionNode = {
      ...node,
      comboValues: { ev: { P1: [6, 2], P2: [] }, equity: { P1: [0.8, 0.4], P2: [] } },
    };
    render(
      <SuitedComboBreakdown
        selectedHand="AKs"
        node={withValues}
        range={range}
        board={["2c", "7d", "9s"]}
        colors={buildActionColorScale(node.actions)}
        heroLabel="BTN"
        villainLabel="BB"
      />,
    );
    const lines = screen.getAllByTestId("suited-combo-values").map((el) => el.textContent);
    // EQR = EV / (equity × pot): 6 / 8 and 2 / 4.
    expect(lines).toContain("EV 6.00bb · Equity 80.0% · EQR 75.0%");
    expect(lines).toContain("EV 2.00bb · Equity 40.0% · EQR 50.0%");
  });

  it("shows no values for a tree without them", () => {
    render(
      <SuitedComboBreakdown
        selectedHand="AKs"
        node={node}
        range={range}
        board={["2c", "7d", "9s"]}
        colors={buildActionColorScale(node.actions)}
        heroLabel="BTN"
        villainLabel="BB"
      />,
    );
    expect(screen.queryByTestId("suited-combo-values")).toBeNull();
  });
});
