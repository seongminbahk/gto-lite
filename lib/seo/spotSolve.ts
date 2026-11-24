import type { HandFrequency, Position, RangeSource } from "@/types/rangeData";
import { loadEquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { gameFormatById, type GameFormat } from "@/lib/solveEngine/gameFormat";
import { buildFoldPrefixPath } from "@/lib/solveEngine/preview";
import { DEFAULT_RAKE_SETTINGS, NO_RAKE, type RakeSettings } from "@/lib/solveEngine/rake";
import { replayActionPath } from "@/lib/solveEngine/replay";
import { solveActiveSeat } from "@/lib/solveEngine/solve";
import { CHIP_EV, icmById, type IcmStructure } from "@/lib/solveEngine/icm";
import { EMPTY_LINE, encodeSpot, type PreflopStep } from "@/lib/share/spotLink";
import { openersBefore, rangeFormat, type SpotPage } from "./spotPages";

export interface SolvedSpot {
  seat: Position;
  hands: HandFrequency[];
  source: RangeSource;
  potBb: number;
  /** The folds before the seat acts, as the solver's address writes them. */
  path: PreflopStep[];
  /** The query string that opens this spot in the solver (from encodeSpot). */
  solverQuery: string;
  /** What the opener raised to, facing an open. */
  openToBb?: number;
}

/**
 * The table a range page shows: chip EV for tournaments, the default rake
 * for cash — what the solver opens with before anything is changed.
 */
export function spotTable(page: SpotPage): { format: GameFormat; rake: RakeSettings; icm: IcmStructure } {
  const format = gameFormatById(rangeFormat(page.format).formatId)!;
  const icmId = rangeFormat(page.format).icm;
  const icm = (icmId && icmById(icmId)) || CHIP_EV;
  return { format, rake: format.allowsRake ? DEFAULT_RAKE_SETTINGS : { structure: NO_RAKE, noFlopNoDrop: true }, icm };
}

/** The folds (and the open) before the page's seat acts. */
function spotPath(page: SpotPage, format: GameFormat): { path: PreflopStep[]; openToBb?: number } {
  const foldsTo = (path: PreflopStep[], seat: Position): PreflopStep[] => {
    const at = replayActionPath(path, page.stackBb, format);
    if (at.status !== "active") throw new Error(`No decision before ${seat} at ${page.format} ${page.stackBb}bb`);
    if (at.activeSeat === seat) return path;
    const prefix = buildFoldPrefixPath(path, at.activeSeat, seat, page.stackBb, format);
    if (!prefix) throw new Error(`${seat} can't act next at ${page.format} ${page.stackBb}bb`);
    return prefix.map(({ actor, action }) => ({ actor, action }));
  };
  if (page.kind === "open") return { path: foldsTo([], page.seat) };
  const opened = [...foldsTo([], page.opener!), { actor: page.opener!, action: "raise" as const }];
  const afterOpen = replayActionPath(opened, page.stackBb, format);
  if (afterOpen.status !== "active") throw new Error(`The ${page.opener} open ended the hand`);
  return { path: foldsTo(opened, page.seat), openToBb: afterOpen.potState.currentBetToCall };
}

/** The range /api/solve would answer for this spot, worked out at build time by the same engine. */
export function solveSpotPage(page: SpotPage): SolvedSpot {
  const { format, rake, icm } = spotTable(page);
  const { path, openToBb } = spotPath(page, format);
  const replayed = replayActionPath(path, page.stackBb, format);
  if (replayed.status !== "active" || replayed.activeSeat !== page.seat) throw new Error(`The path didn't reach ${page.seat}`);
  const { hands, source } = solveActiveSeat(loadEquityMatrix(), page.seat, replayed.potState, page.stackBb, rake, icm);

  // The default table writes no query at all, and a bare address opens the table this browser last used; the stack alone keeps it a link to this spot.
  const solverQuery = encodeSpot({ settings: { stackBb: page.stackBb, format, rake, icm }, path, postflop: EMPTY_LINE }) || `s=${page.stackBb}`;
  return { seat: page.seat, hands, source, potBb: replayed.potState.potBb, path, solverQuery, ...(openToBb !== undefined ? { openToBb } : {}) };
}

export interface NeighborSpot {
  page: SpotPage;
  hands: HandFrequency[];
}

/**
 * The spots a page compares itself with: first in, the seat before it (the one
 * after, for the first seat); facing an open, the same seat against the opener
 * before (or after) this one. And the same spot at the next deeper stack (the
 * next shallower one at the deepest).
 */
export function spotNeighbors(page: SpotPage): { seat: NeighborSpot | null; stack: NeighborSpot | null } {
  const def = rangeFormat(page.format);
  const neighbour = <T,>(list: readonly T[], item: T): T | undefined => {
    const i = list.indexOf(item);
    return list[i > 0 ? i - 1 : i + 1];
  };
  const seatSide: SpotPage | null =
    page.kind === "open"
      ? ((seat) => (seat ? { ...page, seat } : null))(neighbour(def.seats, page.seat))
      : ((opener) => (opener ? { ...page, opener } : null))(neighbour(openersBefore(def, page.seat), page.opener!));
  const stacks = [...(page.kind === "open" ? def.stacks : def.vsOpen.stacks)].sort((a, b) => a - b);
  const i = stacks.indexOf(page.stackBb);
  const otherStack = stacks[i < stacks.length - 1 ? i + 1 : i - 1];
  const solve = (other: SpotPage): NeighborSpot => ({ page: other, hands: solveSpotPage(other).hands });
  return {
    seat: seatSide ? solve(seatSide) : null,
    stack: otherStack !== undefined ? solve({ ...page, stackBb: otherStack }) : null,
  };
}
