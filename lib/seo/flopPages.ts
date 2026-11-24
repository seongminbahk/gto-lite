import type { PostflopActionType } from "@/lib/postflopSolver/potState";
import type { StrengthBucket } from "@/lib/explain/handStrength";
import type { ActionType, Position } from "@/types/rangeData";

// The /flops pages: how the solver plays common flops in the two most common
// 6-max cash pots. scripts/build-flop-pages.mts solves them with the app's own
// engine and writes data/flopPages.json; the pages only read that file.

export const FLOPS_INDEX_PATH = "/flops";

export interface FlopSpotDef {
  slug: string;
  /** The preflop actions, from the first seat, that lead to the flop. */
  preflop: { actor: Position; action: ActionType }[];
  oop: Position;
  ip: Position;
  /** Who raised last preflop. */
  aggressor: Position;
  threeBet: boolean;
}

const FOLD = "fold" as const;
export const FLOP_SPOTS: FlopSpotDef[] = [
  {
    slug: "btn-vs-bb",
    preflop: [
      { actor: "LJ", action: FOLD },
      { actor: "HJ", action: FOLD },
      { actor: "CO", action: FOLD },
      { actor: "BTN", action: "raise" },
      { actor: "SB", action: FOLD },
      { actor: "BB", action: "call" },
    ],
    oop: "BB",
    ip: "BTN",
    aggressor: "BTN",
    threeBet: false,
  },
  {
    slug: "bb-3bet-vs-btn",
    preflop: [
      { actor: "LJ", action: FOLD },
      { actor: "HJ", action: FOLD },
      { actor: "CO", action: FOLD },
      { actor: "BTN", action: "raise" },
      { actor: "SB", action: FOLD },
      { actor: "BB", action: "raise" },
      { actor: "BTN", action: "call" },
    ],
    oop: "BB",
    ip: "BTN",
    aggressor: "BB",
    threeBet: true,
  },
];

export interface FlopBoardDef {
  slug: string;
  cards: string[];
}

/** "Kh7d2c" → "k72-rainbow": ranks high to low, then rainbow, two-tone or monotone. */
export function boardSlug(cards: string[]): string {
  const order = "AKQJT98765432";
  const ranks = cards.map((c) => c[0]).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const suits = new Set(cards.map((c) => c[1])).size;
  return `${ranks.join("").toLowerCase()}-${suits === 1 ? "monotone" : suits === 2 ? "two-tone" : "rainbow"}`;
}

const board = (s: string): FlopBoardDef => {
  const cards = s.match(/../g)!;
  return { slug: boardSlug(cards), cards };
};

/** High, middle and low; dry and wet; paired and monotone. */
export const FLOP_BOARDS: FlopBoardDef[] = [
  "As7d2c",
  "AsKd5c",
  "AhJhTd",
  "AdQs3d",
  "Ah9h4h",
  "Ks7d2c",
  "KhQh6d",
  "KsTd4h",
  "Kd8d3d",
  "KsKd7c",
  "Qs9d4c",
  "QhJd8h",
  "Js8d3c",
  "JhTh9d",
  "Ts6d2c",
  "Td8c8h",
  "Ts7s4s",
  "9h8h6d",
  "8s5d3c",
  "8d7d2c",
  "7h6d4c",
  "7s7d2c",
  "6s5h4h",
  "5s3d2c",
].map(board);

export interface FlopNodeSummary {
  seat: Position;
  potBb: number;
  actions: { kind: PostflopActionType; bb?: number; potPct?: number; share: number }[];
  /** Each hand-strength group's share of the range, and how it splits over the actions. */
  buckets: Record<StrengthBucket, { share: number; actions: number[] }>;
}

export interface FlopBoardData {
  root: FlopNodeSummary;
  afterCheck: FlopNodeSummary;
  facingBet: (FlopNodeSummary & { facingBb?: number; facingPotPct?: number }) | null;
}

export interface FlopPagesData {
  generatedAt: string;
  spots: Record<string, Record<string, FlopBoardData>>;
}

export interface FlopPage {
  spot: FlopSpotDef;
  board: FlopBoardDef;
}

export function flopPath(page: { spot: { slug: string }; board: { slug: string } }): string {
  return `${FLOPS_INDEX_PATH}/cash-6max/${page.spot.slug}/${page.board.slug}`;
}

/** The pages the data has: a spot and board both defined and solved. */
export function allFlopPages(data: FlopPagesData): FlopPage[] {
  return FLOP_SPOTS.flatMap((spot) => FLOP_BOARDS.filter((b) => data.spots[spot.slug]?.[b.slug]).map((board) => ({ spot, board })));
}

export function parseFlopParams(data: FlopPagesData, params: { spot: string; board: string }): FlopPage | null {
  const spot = FLOP_SPOTS.find((s) => s.slug === params.spot);
  const board = FLOP_BOARDS.find((b) => b.slug === params.board);
  if (!spot || !board || !data.spots[spot.slug]?.[board.slug]) return null;
  return { spot, board };
}
