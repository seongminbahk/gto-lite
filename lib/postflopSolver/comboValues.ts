import type { PostflopPlayer } from "./potState";
import type { CfrSolution } from "./cfr";
import type { EquityTable } from "./terminalEquity";
import { equityVsRange } from "./terminalEquity";
import type { DecisionNode, PostflopTreeNode } from "./treeBuilder";
import type { ComboRange } from "./types";
import { narrowReach } from "./treeMath";
import type { NativeSolveSession } from "./wasm/engine";

/**
 * Both players' per-combo values at one decision node, each array in the combo
 * order of that player's range (heroRange for P1, villainRange for P2). NaN
 * marks a combo that doesn't reach the node.
 */
export interface ComboValues {
  /**
   * Chips (bb) the combo still expects to collect from here, playing the
   * average strategy: what it ends the hand with less what it puts in from
   * now on. Chips already in are sunk, so a hand that checks down gets
   * between 0 and the pot. In a tournament, prize money read as bb (icmPayoffs.ts).
   */
  ev: Record<PostflopPlayer, number[]>;
  /** Showdown equity (0–1) against the opponent's hands that reach the node, averaged over every card still to come. */
  equity: Record<PostflopPlayer, number[]>;
}

/**
 * Every root-street decision node's ComboValues: reaches go down the tree
 * through the average strategy (as checkdownEquity.ts's do), EVs come from
 * the engine (session.comboEv) and equities from the street's equity table.
 */
export function computeComboValues(
  tree: PostflopTreeNode,
  solution: CfrSolution,
  heroRange: ComboRange,
  villainRange: ComboRange,
  equityTable: EquityTable,
  session: Pick<NativeSolveSession, "comboEv">,
): Map<DecisionNode, ComboValues> {
  const values = new Map<DecisionNode, ComboValues>();

  function forPlayer(node: DecisionNode, player: PostflopPlayer, own: number[], opponent: number[], reachP1: number[], reachP2: number[]) {
    const raw = session.comboEv(node, player, reachP1, reachP2);
    const committed = node.state.committed[player];
    const ev = own.map((r, i) => (r > 0 && Number.isFinite(raw[i]) ? raw[i] + committed : NaN));
    const equity = own.map((r, i) => (r > 0 ? equityVsRange(equityTable, player, i, opponent) : NaN));
    return { ev, equity };
  }

  (function walk(node: PostflopTreeNode, reachP1: number[], reachP2: number[]) {
    if (node.type !== "decision") return;
    const p1 = forPlayer(node, "P1", reachP1, reachP2, reachP1, reachP2);
    const p2 = forPlayer(node, "P2", reachP2, reachP1, reachP1, reachP2);
    values.set(node, { ev: { P1: p1.ev, P2: p2.ev }, equity: { P1: p1.equity, P2: p2.equity } });
    const isP1Acting = node.actor === "P1";
    const strategy = solution.getAverageStrategy(node);
    node.actions.forEach(({ child }, a) => {
      walk(child, isP1Acting ? narrowReach(reachP1, strategy, a) : reachP1, isP1Acting ? reachP2 : narrowReach(reachP2, strategy, a));
    });
  })(
    tree,
    heroRange.map((c) => c.weight),
    villainRange.map((c) => c.weight),
  );
  return values;
}
