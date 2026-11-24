import type { Position } from "@/types/rangeData";
import type { GameFormatId } from "@/lib/solveEngine/gameFormat";
import type { IcmId } from "@/lib/solveEngine/icm";

/**
 * The preflop spots that get a static page of their own under /ranges: one
 * per format, stack and seat, each the seat's range when it folds to them.
 * Pure data and address helpers, so the sitemap can list them without
 * loading the solve engine.
 */

export type RangeFormatSlug = "mtt" | "mtt-bubble" | "mtt-final-table" | "cash-6max";
export type SpotKind = "open" | "vs-open";

export interface RangeFormatDef {
  slug: RangeFormatSlug;
  formatId: GameFormatId;
  /** The seats that can be first in, earliest first. */
  seats: Position[];
  stacks: number[];
  /** The payout pressure the ranges are solved under; chip EV without one. */
  icm?: IcmId;
  /** Pages for a seat facing one open: the stacks, and the seats that get one (each against every earlier opener). */
  vsOpen: { stacks: number[]; defenders: Position[] };
}

export const RANGE_FORMATS: RangeFormatDef[] = [
  {
    slug: "mtt",
    formatId: "tournament-8",
    seats: ["UTG", "UTG1", "LJ", "HJ", "CO", "BTN", "SB"],
    stacks: [10, 15, 20, 25, 30, 40, 60, 100],
    // From 20bb up an open is a raise, not a shove; the button and the blinds defend most.
    vsOpen: { stacks: [20, 30, 40, 100], defenders: ["BTN", "SB", "BB"] },
  },
  // The same table on the money bubble and at the final table, solved under ICM. Only where ICM changes the
  // range: push/fold stacks, and the big blind's defense. Deeper opens come out as at chip EV, so no page repeats them.
  {
    slug: "mtt-bubble",
    formatId: "tournament-8",
    icm: "bubble",
    seats: ["UTG", "UTG1", "LJ", "HJ", "CO", "BTN", "SB"],
    stacks: [10, 12],
    vsOpen: { stacks: [20, 40], defenders: ["BB"] },
  },
  {
    slug: "mtt-final-table",
    formatId: "tournament-8",
    icm: "final-table",
    seats: ["UTG", "UTG1", "LJ", "HJ", "CO", "BTN", "SB"],
    stacks: [10, 12],
    vsOpen: { stacks: [20, 40], defenders: ["BB"] },
  },
  {
    slug: "cash-6max",
    formatId: "cash-6",
    seats: ["LJ", "HJ", "CO", "BTN", "SB"],
    stacks: [100],
    vsOpen: { stacks: [100], defenders: ["HJ", "CO", "BTN", "SB", "BB"] },
  },
];

/** A first-in range ("open"), or a seat's range facing one earlier seat's open with everyone else folding ("vs-open"). */
export interface SpotPage {
  format: RangeFormatSlug;
  stackBb: number;
  seat: Position;
  kind: SpotKind;
  /** The seat that opened, for "vs-open". */
  opener?: Position;
}

export interface SpotParams {
  format: string;
  stack: string;
  spot: string;
}

export function rangeFormat(slug: RangeFormatSlug): RangeFormatDef {
  return RANGE_FORMATS.find((f) => f.slug === slug)!;
}

/** The seats that can open before this one acts, earliest first. */
export function openersBefore(def: RangeFormatDef, defender: Position): Position[] {
  const index = def.seats.indexOf(defender);
  return index < 0 ? def.seats : def.seats.slice(0, index);
}

export function openSpotPages(): SpotPage[] {
  return RANGE_FORMATS.flatMap((f) => f.stacks.flatMap((stackBb) => f.seats.map((seat) => ({ format: f.slug, stackBb, seat, kind: "open" as const }))));
}

export function vsOpenSpotPages(): SpotPage[] {
  return RANGE_FORMATS.flatMap((f) =>
    f.vsOpen.stacks.flatMap((stackBb) =>
      f.vsOpen.defenders.flatMap((seat) => openersBefore(f, seat).map((opener) => ({ format: f.slug, stackBb, seat, kind: "vs-open" as const, opener }))),
    ),
  );
}

export function allSpotPages(): SpotPage[] {
  return [...openSpotPages(), ...vsOpenSpotPages()];
}

export function spotParams(page: SpotPage): SpotParams {
  const spot = page.kind === "open" ? `${page.seat.toLowerCase()}-open` : `${page.seat.toLowerCase()}-vs-${page.opener!.toLowerCase()}-open`;
  return { format: page.format, stack: `${page.stackBb}bb`, spot };
}

/** The page an address names, or null for one no page answers. */
export function parseSpotParams(params: SpotParams): SpotPage | null {
  const format = RANGE_FORMATS.find((f) => f.slug === params.format);
  const stack = /^(\d+)bb$/.exec(params.stack);
  if (!format || !stack || String(Number(stack[1])) !== stack[1]) return null;
  const stackBb = Number(stack[1]);
  const seatNamed = (slug: string, seats: readonly Position[]) => seats.find((s) => s.toLowerCase() === slug);

  const open = /^([a-z0-9]+)-open$/.exec(params.spot);
  if (open) {
    const seat = seatNamed(open[1], format.seats);
    if (!seat || !format.stacks.includes(stackBb)) return null;
    return { format: format.slug, stackBb, seat, kind: "open" };
  }
  const vs = /^([a-z0-9]+)-vs-([a-z0-9]+)-open$/.exec(params.spot);
  if (vs) {
    const seat = seatNamed(vs[1], format.vsOpen.defenders);
    const opener = seat && seatNamed(vs[2], openersBefore(format, seat));
    if (!seat || !opener || !format.vsOpen.stacks.includes(stackBb)) return null;
    return { format: format.slug, stackBb, seat, kind: "vs-open", opener };
  }
  return null;
}

/** The English address; localePath puts it under /ko. */
export function spotPath(page: SpotPage): string {
  const { format, stack, spot } = spotParams(page);
  return `/ranges/${format}/${stack}/${spot}`;
}

export const RANGES_INDEX_PATH = "/ranges";

/** The same spot at the other stacks that have one. */
export function otherStacks(page: SpotPage): SpotPage[] {
  const def = rangeFormat(page.format);
  const stacks = page.kind === "open" ? def.stacks : def.vsOpen.stacks;
  return stacks.filter((s) => s !== page.stackBb).map((stackBb) => ({ ...page, stackBb }));
}

/** First in: the format's other seats at the same stack. Facing an open: the same seat against the other openers. */
export function otherSeats(page: SpotPage): SpotPage[] {
  const def = rangeFormat(page.format);
  if (page.kind === "open") return def.seats.filter((s) => s !== page.seat).map((seat) => ({ ...page, seat }));
  return openersBefore(def, page.seat)
    .filter((o) => o !== page.opener)
    .map((opener) => ({ ...page, opener }));
}

/** First in: the pages of the seats that defend against this open. Facing an open: the opener's own range. */
export function relatedSpots(page: SpotPage): SpotPage[] {
  const def = rangeFormat(page.format);
  if (page.kind === "vs-open") return def.stacks.includes(page.stackBb) ? [{ format: page.format, stackBb: page.stackBb, seat: page.opener!, kind: "open" }] : [];
  if (!def.vsOpen.stacks.includes(page.stackBb)) return [];
  return def.vsOpen.defenders
    .filter((d) => openersBefore(def, d).includes(page.seat))
    .map((seat) => ({ format: page.format, stackBb: page.stackBb, seat, kind: "vs-open" as const, opener: page.seat }));
}
