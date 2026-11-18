import type { Position } from "@/types/rangeData";
import type { GameFormatId } from "@/lib/solveEngine/gameFormat";

/**
 * The preflop spots that get a static page of their own under /ranges: one
 * per format, stack and seat, each the seat's range when it folds to them.
 * Pure data and address helpers, so the sitemap can list them without
 * loading the solve engine.
 */

export type RangeFormatSlug = "mtt" | "cash-6max";
export type SpotKind = "open";

export interface RangeFormatDef {
  slug: RangeFormatSlug;
  formatId: GameFormatId;
  /** The seats that can be first in, earliest first. */
  seats: Position[];
  stacks: number[];
}

export const RANGE_FORMATS: RangeFormatDef[] = [
  { slug: "mtt", formatId: "tournament-8", seats: ["UTG", "UTG1", "LJ", "HJ", "CO", "BTN", "SB"], stacks: [10, 15, 20, 25, 30, 40, 60, 100] },
  { slug: "cash-6max", formatId: "cash-6", seats: ["LJ", "HJ", "CO", "BTN", "SB"], stacks: [100] },
];

export interface SpotPage {
  format: RangeFormatSlug;
  stackBb: number;
  seat: Position;
  kind: SpotKind;
}

export interface SpotParams {
  format: string;
  stack: string;
  spot: string;
}

export function rangeFormat(slug: RangeFormatSlug): RangeFormatDef {
  return RANGE_FORMATS.find((f) => f.slug === slug)!;
}

export function allSpotPages(): SpotPage[] {
  return RANGE_FORMATS.flatMap((f) => f.stacks.flatMap((stackBb) => f.seats.map((seat) => ({ format: f.slug, stackBb, seat, kind: "open" as const }))));
}

export function spotParams(page: SpotPage): SpotParams {
  return { format: page.format, stack: `${page.stackBb}bb`, spot: `${page.seat.toLowerCase()}-${page.kind}` };
}

/** The page an address names, or null for one no page answers. */
export function parseSpotParams(params: SpotParams): SpotPage | null {
  const format = RANGE_FORMATS.find((f) => f.slug === params.format);
  const stack = /^(\d+)bb$/.exec(params.stack);
  const spot = /^([a-z0-9]+)-(open)$/.exec(params.spot);
  if (!format || !stack || !spot) return null;
  const stackBb = Number(stack[1]);
  const seat = format.seats.find((s) => s.toLowerCase() === spot[1]);
  if (!seat || !format.stacks.includes(stackBb) || String(stackBb) !== stack[1]) return null;
  return { format: format.slug, stackBb, seat, kind: "open" };
}

/** The English address; localePath puts it under /ko. */
export function spotPath(page: SpotPage): string {
  const { format, stack, spot } = spotParams(page);
  return `/ranges/${format}/${stack}/${spot}`;
}

export const RANGES_INDEX_PATH = "/ranges";

/** The same seat at the format's other stacks. */
export function otherStacks(page: SpotPage): SpotPage[] {
  return rangeFormat(page.format).stacks.filter((s) => s !== page.stackBb).map((stackBb) => ({ ...page, stackBb }));
}

/** The format's other seats at the same stack. */
export function otherSeats(page: SpotPage): SpotPage[] {
  return rangeFormat(page.format).seats.filter((s) => s !== page.seat).map((seat) => ({ ...page, seat }));
}
