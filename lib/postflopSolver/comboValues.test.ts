// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ALL_HANDS } from "@/lib/handRange/handList";
import { computeComboValues } from "./comboValues";
import { solvePostflopStreet } from "./solvePostflop";
import { liveOpponentReach } from "./terminalEquity";
import { narrowReach, weightedAverage } from "./treeMath";
import type { DecisionNode, PostflopTreeNode } from "./treeBuilder";
import { loadNodeSolverModule } from "./wasm/loadNode";

const hands = (labels: string[]) => ALL_HANDS.map((h) => ({ hand: h.hand, fold: 0, call: labels.includes(h.hand) ? 1 : 0, raise: 0 }));

async function solve(board: string[], heroHands: string[], villainHands: string[], startPot: number, stack: number) {
  const solver = await loadNodeSolverModule();
  const result = solvePostflopStreet(
    {
      kind: "canonical",
      board,
      heroHandFrequencies: hands(heroHands),
      heroActionWeight: (hf) => hf.call,
      villainHandFrequencies: hands(villainHands),
      villainActionWeight: (hf) => hf.call,
      startPot,
      effectiveStackBb: stack,
      maxIterations: 3000,
      targetExploitabilityPercent: 0.3,
    },
    { solver },
  );
  const session = result.session!;
  const values = computeComboValues(result.tree, result.solution, result.heroRange, result.villainRange, result.equityTable, session);
  return { result, session, values };
}

describe("computeComboValues", () => {
  it("values a river: the nuts at 100% equity, a pure fold at 0, and the root's average at the solve's EV", async () => {
    const board = ["Kh", "7s", "2d", "As", "9c"];
    const { result, session, values } = await solve(board, ["AA", "KK", "QJs", "65s"], ["AK", "KQo", "T8s", "77"], 10, 40);
    try {
      const root = result.tree as DecisionNode;
      const atRoot = values.get(root)!;
      expect(atRoot.ev.P1).toHaveLength(result.heroRange.length);
      expect(atRoot.equity.P2).toHaveLength(result.villainRange.length);

      // Top set beats every hand the villain can hold.
      const aces = result.heroRange.findIndex((c) => c.cards.join("") === "AhAd" || c.cards.join("") === "AdAh");
      expect(atRoot.equity.P1[aces]).toBe(1);

      // Weighted by the pairs of hands that can both exist, the combos average to the solve's own EV.
      const heroReach = result.heroRange.map((c) => c.weight);
      const villainReach = result.villainRange.map((c) => c.weight);
      const p1 = weightedAverage(
        atRoot.ev.P1,
        heroReach.map((r, i) => r * liveOpponentReach(result.equityTable, "P1", i, villainReach)),
      );
      const p2 = weightedAverage(
        atRoot.ev.P2,
        villainReach.map((r, j) => r * liveOpponentReach(result.equityTable, "P2", j, heroReach)),
      );
      expect(p1).toBeCloseTo(result.exploitability.p1ActualBb, 2);
      expect(p2).toBeCloseTo(result.exploitability.p2ActualBb, 2);

      // Facing a bet, a combo that always folds puts nothing more in and wins nothing: chips in are sunk.
      let folds = 0;
      (function walk(node: PostflopTreeNode, reachP1: number[], reachP2: number[]) {
        if (node.type !== "decision") return;
        const strategy = result.solution.getAverageStrategy(node);
        const foldIndex = node.actions.findIndex((a) => a.action === "fold");
        const own = node.actor === "P1" ? reachP1 : reachP2;
        if (foldIndex >= 0) {
          strategy.forEach((row, c) => {
            const ev = values.get(node)!.ev[node.actor][c];
            // NaN: no opponent hand gets here with this combo's cards out.
            if (own[c] > 0 && row[foldIndex] > 0.999 && !Number.isNaN(ev)) {
              expect(Math.abs(ev)).toBeLessThan(0.05);
              folds++;
            }
          });
        }
        node.actions.forEach(({ child }, a) => {
          walk(child, node.actor === "P1" ? narrowReach(reachP1, strategy, a) : reachP1, node.actor === "P2" ? narrowReach(reachP2, strategy, a) : reachP2);
        });
      })(root, heroReach, villainReach);
      expect(folds).toBeGreaterThan(0);
    } finally {
      session.dispose();
    }
  });

  it("values every flop decision, looking ahead: the root's average is the solve's EV, and the two equities sum to 1", async () => {
    const board = ["Kh", "7s", "2d"];
    const { result, session, values } = await solve(board, ["AA", "KK", "AKs", "QJs"], ["77", "98s", "KQo", "A5s"], 7.5, 20);
    try {
      let decisions = 0;
      (function walk(node: PostflopTreeNode) {
        if (node.type !== "decision") return;
        decisions++;
        expect(values.has(node)).toBe(true);
        node.actions.forEach(({ child }) => walk(child));
      })(result.tree);
      expect(values.size).toBe(decisions);

      const atRoot = values.get(result.tree as DecisionNode)!;
      const heroReach = result.heroRange.map((c) => c.weight);
      const villainReach = result.villainRange.map((c) => c.weight);
      const heroPairs = heroReach.map((r, i) => r * liveOpponentReach(result.equityTable, "P1", i, villainReach));
      const villainPairs = villainReach.map((r, j) => r * liveOpponentReach(result.equityTable, "P2", j, heroReach));
      expect(weightedAverage(atRoot.ev.P1, heroPairs)).toBeCloseTo(result.exploitability.p1ActualBb, 2);
      expect(weightedAverage(atRoot.ev.P2, villainPairs)).toBeCloseTo(result.exploitability.p2ActualBb, 2);
      expect(weightedAverage(atRoot.equity.P1, heroPairs) + weightedAverage(atRoot.equity.P2, villainPairs)).toBeCloseTo(1, 4);
    } finally {
      session.dispose();
    }
  });
});
