import type { HandFrequency, Position, RangeSource } from "@/types/rangeData";
import { loadEquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { gameFormatById, type GameFormat } from "@/lib/solveEngine/gameFormat";
import { buildFoldPrefixPath } from "@/lib/solveEngine/preview";
import { DEFAULT_RAKE_SETTINGS, NO_RAKE, type RakeSettings } from "@/lib/solveEngine/rake";
import { replayActionPath } from "@/lib/solveEngine/replay";
import { solveActiveSeat } from "@/lib/solveEngine/solve";
import { CHIP_EV } from "@/lib/solveEngine/icm";
import { EMPTY_LINE, encodeSpot, type PreflopStep } from "@/lib/share/spotLink";
import { rangeFormat, type SpotPage } from "./spotPages";

export interface SolvedSpot {
  seat: Position;
  hands: HandFrequency[];
  source: RangeSource;
  potBb: number;
  /** The folds before the seat acts, as the solver's address writes them. */
  path: PreflopStep[];
  /** The query string that opens this spot in the solver (from encodeSpot). */
  solverQuery: string;
}

/**
 * The table a range page shows: chip EV for tournaments, the default rake
 * for cash — what the solver opens with before anything is changed.
 */
export function spotTable(page: SpotPage): { format: GameFormat; rake: RakeSettings } {
  const format = gameFormatById(rangeFormat(page.format).formatId)!;
  return { format, rake: format.allowsRake ? DEFAULT_RAKE_SETTINGS : { structure: NO_RAKE, noFlopNoDrop: true } };
}

/** The range /api/solve would answer for this spot, worked out at build time by the same engine. */
export function solveSpotPage(page: SpotPage): SolvedSpot {
  const { format, rake } = spotTable(page);
  const start = replayActionPath([], page.stackBb, format);
  if (start.status !== "active") throw new Error(`No first decision at ${page.format} ${page.stackBb}bb`);
  const prefix = page.seat === start.activeSeat ? [] : buildFoldPrefixPath([], start.activeSeat, page.seat, page.stackBb, format);
  if (!prefix) throw new Error(`${page.seat} can't be first in at ${page.format}`);
  const path: PreflopStep[] = prefix.map(({ actor, action }) => ({ actor, action }));

  const replayed = replayActionPath(path, page.stackBb, format);
  if (replayed.status !== "active" || replayed.activeSeat !== page.seat) throw new Error(`Folding to ${page.seat} didn't reach ${page.seat}`);
  const { hands, source } = solveActiveSeat(loadEquityMatrix(), page.seat, replayed.potState, page.stackBb, rake, CHIP_EV);

  // The default table writes no query at all, and a bare address opens the table this browser last used; the stack alone keeps it a link to this spot.
  const solverQuery = encodeSpot({ settings: { stackBb: page.stackBb, format, rake, icm: CHIP_EV }, path, postflop: EMPTY_LINE }) || `s=${page.stackBb}`;
  return { seat: page.seat, hands, source, potBb: replayed.potState.potBb, path, solverQuery };
}
