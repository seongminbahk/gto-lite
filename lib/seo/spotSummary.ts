import type { HandFrequency } from "@/types/rangeData";
import { HAND_BY_LABEL, TOTAL_COMBOS } from "@/lib/handRange/handList";
import { RANKS } from "@/lib/cards";

export type ActionKey = "fold" | "call" | "raise" | "allin";
export type EdgeCategory = "pairs" | "suitedAces" | "offsuitAces" | "suitedKings" | "offsuitKings";

export interface RangeStats {
  /** Each action's share of all 1326 combos. */
  share: Record<ActionKey, number>;
  /** Combos that don't fold. */
  playedCombos: number;
  /** Hands neither always played nor always folded. */
  mixedHands: number;
  /** The lowest hand of each row that is played at least half the time. */
  edges: { category: EdgeCategory; hand: string }[];
  /** Raise first, no all-ins: the stack is too short for anything but push or fold. */
  pushFold: boolean;
}

const MIXED_MIN = 0.05;
const PLAYED_MIN = 0.5;

const ROWS: Record<EdgeCategory, string[]> = {
  pairs: RANKS.map((r) => `${r}${r}`),
  suitedAces: RANKS.slice(1).map((r) => `A${r}s`),
  offsuitAces: RANKS.slice(1).map((r) => `A${r}o`),
  suitedKings: RANKS.slice(2).map((r) => `K${r}s`),
  offsuitKings: RANKS.slice(2).map((r) => `K${r}o`),
};

const played = (h: HandFrequency | undefined) => (h ? 1 - h.fold : 0);

export function rangeStats(hands: readonly HandFrequency[]): RangeStats {
  const combos: Record<ActionKey, number> = { fold: 0, call: 0, raise: 0, allin: 0 };
  let mixedHands = 0;
  for (const h of hands) {
    const n = HAND_BY_LABEL.get(h.hand)?.combos ?? 0;
    combos.fold += h.fold * n;
    combos.call += h.call * n;
    combos.raise += h.raise * n;
    combos.allin += (h.allin ?? 0) * n;
    const p = played(h);
    if (p > MIXED_MIN && p < 1 - MIXED_MIN) mixedHands++;
  }
  const share = Object.fromEntries(Object.entries(combos).map(([k, v]) => [k, v / TOTAL_COMBOS])) as Record<ActionKey, number>;

  const byHand = new Map(hands.map((h) => [h.hand, h]));
  const edges = (Object.keys(ROWS) as EdgeCategory[]).flatMap((category) => {
    const lowest = ROWS[category].filter((hand) => played(byHand.get(hand)) >= PLAYED_MIN).at(-1);
    return lowest ? [{ category, hand: lowest }] : [];
  });

  return {
    share,
    playedCombos: TOTAL_COMBOS - combos.fold,
    mixedHands,
    edges,
    pushFold: share.allin > 0 && share.raise < 0.001 && share.call < 0.001,
  };
}
