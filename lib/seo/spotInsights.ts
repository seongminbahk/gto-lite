import type { HandFrequency } from "@/types/rangeData";
import { ALL_HANDS } from "@/lib/handRange/handList";
import { PLAYED_MIN, ROWS, type EdgeCategory } from "./spotSummary";

// What makes one range page different from the next: which hands it adds or
// drops against a neighbouring spot, which hands it mixes, and the yes/no
// questions a player asks about its weakest hands. All from the solved range.

export interface HandShare {
  hand: string;
  /** How often the hand is played (not folded), 0–1. */
  played: number;
}

export interface RangeDiff {
  /** Played at least half the time here but not there, strongest first. */
  added: string[];
  /** Played at least half the time there but not here. */
  dropped: string[];
}

export interface EdgeQuestion {
  category: EdgeCategory;
  /** The weakest hand of the row played at least half the time. */
  edge: HandShare;
  /** The next hand down the row. */
  below: HandShare;
}

const MIXED_MIN = 0.05;
const ORDER = ALL_HANDS.map((h) => h.hand);

function playedMap(hands: readonly HandFrequency[]): Map<string, number> {
  return new Map(hands.map((h) => [h.hand, 1 - h.fold]));
}

export function rangeDiff(hands: readonly HandFrequency[], other: readonly HandFrequency[]): RangeDiff {
  const here = playedMap(hands);
  const there = playedMap(other);
  const isPlayed = (m: Map<string, number>, hand: string) => (m.get(hand) ?? 0) >= PLAYED_MIN;
  return {
    added: ORDER.filter((hand) => isPlayed(here, hand) && !isPlayed(there, hand)),
    dropped: ORDER.filter((hand) => !isPlayed(here, hand) && isPlayed(there, hand)),
  };
}

/** Hands played only part of the time, most often played first. */
export function mixedHandShares(hands: readonly HandFrequency[]): HandShare[] {
  return [...playedMap(hands)]
    .filter(([, played]) => played > MIXED_MIN && played < 1 - MIXED_MIN)
    .map(([hand, played]) => ({ hand, played }))
    .sort((a, b) => b.played - a.played || ORDER.indexOf(a.hand) - ORDER.indexOf(b.hand));
}

/** For each row with a cut-off inside it, the last hand played and the first one below it. */
export function edgeQuestions(hands: readonly HandFrequency[]): EdgeQuestion[] {
  const played = playedMap(hands);
  return (Object.keys(ROWS) as EdgeCategory[]).flatMap((category) => {
    const row = ROWS[category];
    const index = row.findLastIndex((hand) => (played.get(hand) ?? 0) >= PLAYED_MIN);
    // Only a cut-off inside the row: not a row played to its end, nor one whose top hand is all it plays.
    if (index < 1 || index === row.length - 1) return [];
    const at = (hand: string) => ({ hand, played: played.get(hand) ?? 0 });
    return [{ category, edge: at(row[index]), below: at(row[index + 1]) }];
  });
}
