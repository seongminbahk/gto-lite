import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DecisionStrategyView } from "./DecisionStrategyView";
import type { SerializedCombo, SerializedDecisionNode } from "@/types/postflopSolver";

const terminal = { type: "terminal-showdown" as const, potBb: 10, committed: { P1: 0, P2: 0 } };
const node: SerializedDecisionNode = {
  type: "decision",
  actor: "P1",
  potBb: 10,
  currentBetToCall: 0,
  actions: [{ action: "check", label: "Check", child: terminal }],
  strategy: [[1]],
  comboValues: { ev: { P1: [6], P2: [4] }, equity: { P1: [0.6], P2: [0.4] } },
};
const hero: SerializedCombo[] = [{ cards: ["Ah", "Kh"], weight: 1 }];
const villain: SerializedCombo[] = [{ cards: ["Qs", "Qd"], weight: 1 }];

function view(props: Partial<Parameters<typeof DecisionStrategyView>[0]>) {
  return (
    <DecisionStrategyView
      node={node}
      range={hero}
      opponentRange={villain}
      board={["2c", "7d", "9s"]}
      heroLabel="BB"
      villainLabel="BTN"
      selectedHand={null}
      onSelectHand={() => {}}
      isolatedActionIndex={null}
      onIsolateChange={() => {}}
      view="strategy"
      onViewChange={() => {}}
      {...props}
    />
  );
}

describe("DecisionStrategyView", () => {
  it("switches the grid between strategy and a value, and shows the equity distribution", () => {
    const onViewChange = vi.fn();
    const { rerender } = render(view({ onViewChange }));
    expect(screen.getAllByTestId("postflop-hand-cell").length).toBe(169);
    expect(screen.getByTestId("equity-distribution")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Equity" }));
    expect(onViewChange).toHaveBeenCalledWith("equity");

    rerender(view({ view: "equity" }));
    expect(screen.getAllByTestId("value-hand-cell").length).toBe(169);
    expect(screen.getByTestId("value-view-hint")).toBeInTheDocument();
  });

  it("offers only the strategy for a tree without values", () => {
    render(view({ node: { ...node, comboValues: undefined }, view: "ev" }));
    expect(screen.getByRole("button", { name: "EV" })).toBeDisabled();
    expect(screen.getAllByTestId("postflop-hand-cell").length).toBe(169);
    expect(screen.queryByTestId("equity-distribution")).toBeNull();
  });
});
