import type { HandSummary, PostflopDecisionSummary } from "../summarySchema";

/**
 * What kind of hand this was, read off the summary alone: the tags the
 * concept notes are chosen by. Every tag is a plain fact about the line, so
 * the same hand always gets the same notes.
 */
export const FEATURE_TAGS = [
  "limped-pot",
  "srp",
  "3bet-pot",
  "4bet-pot",
  "bvb",
  "spr-low",
  "spr-mid",
  "spr-high",
  "board-paired",
  "board-monotone",
  "board-connected",
  "board-high-dry",
  "board-low",
  "range-advantage",
  "nut-advantage",
  "ip-aggressor-cbet",
  "oop-aggressor",
  "oop-checks-to-aggressor",
  "small-bet",
  "big-bet",
  "overbet",
  "allin",
  "check-raise",
  "donk",
  "facing-bet",
  "draws",
  "turn",
  "river",
  "icm",
  "rake",
  "ante",
  "push-fold",
] as const;
export type FeatureTag = (typeof FEATURE_TAGS)[number];

const RANK_VALUE: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, T: 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2 };

/** Low SPR commits the stacks by the river; high leaves room to play every street. */
const SPR_LOW_MAX = 4;
const SPR_HIGH_MIN = 10;
/** Bet sizes as a share of the pot. */
const SMALL_BET_MAX = 0.4;
const BIG_BET_MIN = 0.66;
/** Percentage points between the two ranges' buckets that count as an advantage. */
const RANGE_ADVANTAGE_PP = 10;
const NUT_ADVANTAGE_PP = 5;
/** A range holding this much in the draw bucket plays draws as semi-bluffs. */
const DRAW_SHARE_MIN = 10;

const AGGRESSIVE = /^(Bet|Raise to|Allin) /;
const sizeOf = (label: string) => Number(/([\d.]+)bb$/.exec(label)?.[1] ?? 0);

export function extractFeatures(summary: HandSummary): Set<FeatureTag> {
  const tags = new Set<FeatureTag>();
  const { oop, ip } = summary.seats;

  // Preflop: how many raises went in, and who made the last.
  const raises = summary.preflop.decisions.filter((d) => d.action === "raise" || d.action === "allin");
  if (raises.length === 0) tags.add("limped-pot");
  else if (raises.length === 1) tags.add("srp");
  else if (raises.length === 2) tags.add("3bet-pot");
  else tags.add("4bet-pot");
  const preflopAggressor = raises.at(-1)?.seat;
  if (preflopAggressor === oop) tags.add("oop-aggressor");
  if (oop === "SB" && ip === "BB") tags.add("bvb");
  if (summary.preflop.decisions.some((d) => d.source === "nash-shove-fold")) tags.add("push-fold");

  if (summary.game.icm !== "chip-ev") tags.add("icm");
  if (summary.game.rake !== "none") tags.add("rake");
  if (summary.game.format === "tournament-8") tags.add("ante");

  const flop = summary.streets[0];
  const spr = flop.startPotBb > 0 ? flop.stackBb / flop.startPotBb : Infinity;
  tags.add(spr <= SPR_LOW_MAX ? "spr-low" : spr >= SPR_HIGH_MIN ? "spr-high" : "spr-mid");
  for (const tag of boardTags(flop.board.slice(0, 3))) tags.add(tag);

  // Range and nut advantage on the flop, either way round.
  const [a, b] = flop.ranges;
  const strongShare = (r: typeof a) => r.buckets.nuts + r.buckets.strong;
  if (Math.abs(strongShare(a) - strongShare(b)) >= RANGE_ADVANTAGE_PP) tags.add("range-advantage");
  if (Math.abs(a.buckets.nuts - b.buckets.nuts) >= NUT_ADVANTAGE_PP) tags.add("nut-advantage");

  let lastAggressor = preflopAggressor;
  for (const street of summary.streets) {
    if (street.street === "Turn") tags.add("turn");
    if (street.street === "River") tags.add("river");
    if (street.street !== "River" && street.ranges.some((r) => r.buckets.draw >= DRAW_SHARE_MIN)) tags.add("draws");

    const checked = new Set<string>();
    street.decisions.forEach((d, i) => {
      for (const tag of decisionTags(d)) tags.add(tag);
      const aggressive = AGGRESSIVE.test(d.taken);
      if (i === 0 && d.seat === oop && lastAggressor === ip) {
        if (aggressive) tags.add("donk");
        else if (d.taken === "Check") tags.add("oop-checks-to-aggressor");
      }
      if (street.street === "Flop" && d.seat === ip && preflopAggressor === ip && d.toCallBb === 0 && aggressive) tags.add("ip-aggressor-cbet");
      if (d.taken.startsWith("Raise to") && checked.has(d.seat)) tags.add("check-raise");
      if (d.taken === "Check") checked.add(d.seat);
    });
    const aggressor = street.decisions.filter((d) => AGGRESSIVE.test(d.taken)).at(-1)?.seat;
    if (aggressor) lastAggressor = aggressor;
  }
  return tags;
}

function decisionTags(d: PostflopDecisionSummary): FeatureTag[] {
  const tags: FeatureTag[] = [];
  if (d.toCallBb > 0) tags.push("facing-bet");
  if (d.taken.startsWith("Allin")) tags.push("allin");
  if (d.taken.startsWith("Bet")) {
    const share = d.potBb > 0 ? sizeOf(d.taken) / d.potBb : 0;
    if (share > 1) tags.push("overbet", "big-bet");
    else if (share >= BIG_BET_MIN) tags.push("big-bet");
    else if (share <= SMALL_BET_MAX) tags.push("small-bet");
  }
  return tags;
}

/** Flop texture: paired, monotone, connected, dry with a high card, or all low. */
export function boardTags(board: string[]): FeatureTag[] {
  const tags: FeatureTag[] = [];
  const ranks = board.map((c) => RANK_VALUE[c[0]]).sort((x, y) => y - x);
  const suits = new Set(board.map((c) => c[1]));
  const paired = new Set(ranks).size < ranks.length;
  if (paired) tags.push("board-paired");
  if (suits.size === 1) tags.push("board-monotone");
  // Three distinct ranks within a span of four (wheel aces counted low too) leave straights possible.
  const distinct = [...new Set(ranks)];
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  const connected =
    distinct.length === 3 && (span(distinct) <= 4 || (distinct[0] === 14 && span([1, ...distinct.slice(1)]) <= 4));
  if (connected) tags.push("board-connected");
  if (ranks[0] >= 12 && !connected && suits.size === 3 && !paired) tags.push("board-high-dry");
  if (ranks[0] <= 9) tags.push("board-low");
  return tags;
}
