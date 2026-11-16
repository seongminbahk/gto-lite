import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValueRangeGrid } from "./ValueRangeGrid";
import { EquityDistributionChart } from "./EquityDistributionChart";
import type { SerializedCombo, SerializedDecisionNode } from "@/types/postflopSolver";

const hero: SerializedCombo[] = [
  { cards: ["Ah", "Kh"], weight: 1 },
  { cards: ["7c", "7d"], weight: 1 },
];
const villain: SerializedCombo[] = [{ cards: ["Qs", "Qd"], weight: 1 }];
const node: SerializedDecisionNode = {
  type: "decision",
  actor: "P1",
  potBb: 10,
  currentBetToCall: 0,
  actions: [],
  strategy: [],
  comboValues: { ev: { P1: [7.5, 2], P2: [5] }, equity: { P1: [0.7, 0.2], P2: [0.55] } },
};

describe("ValueRangeGrid", () => {
  it("labels each hand in range with the chosen value, and leaves the rest empty", () => {
    const { rerender } = render(<ValueRangeGrid range={hero} node={node} view="equity" selectedHand={null} onSelectHand={() => {}} />);
    const cell = (hand: string) => screen.getAllByTestId("value-hand-cell").find((el) => el.dataset.hand === hand)!;
    expect(cell("AKs").textContent).toBe("AKs70");
    expect(cell("77").textContent).toBe("7720");
    expect(cell("QQ")).toBeDisabled();
    expect(cell("QQ").textContent).toBe("QQ");

    rerender(<ValueRangeGrid range={hero} node={node} view="ev" selectedHand={null} onSelectHand={() => {}} />);
    expect(cell("AKs").textContent).toBe("AKs7.50");
    rerender(<ValueRangeGrid range={hero} node={node} view="eqr" selectedHand={null} onSelectHand={() => {}} />);
    // 7.5 / (0.7 × 10)
    expect(cell("AKs").textContent).toBe("AKs107");
  });
});

describe("EquityDistributionChart", () => {
  it("draws one curve per range, with each range's average equity in the legend", () => {
    render(<EquityDistributionChart node={node} ranges={{ P1: hero, P2: villain }} labels={{ P1: "BB", P2: "BTN" }} />);
    expect(screen.getByTestId("equity-curve-P1").getAttribute("d")).toMatch(/^M/);
    expect(screen.getByTestId("equity-curve-P2").getAttribute("d")).toMatch(/^M/);
    expect(screen.getByText("BB 45%")).toBeInTheDocument();
    expect(screen.getByText("BTN 55%")).toBeInTheDocument();
  });

  it("draws nothing for a tree without values", () => {
    const { container } = render(
      <EquityDistributionChart node={{ ...node, comboValues: undefined }} ranges={{ P1: hero, P2: villain }} labels={{ P1: "BB", P2: "BTN" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
