import { ALL_HANDS } from "@/lib/handRange/handList";
import { formatRangeText, handsOfWeights, parseRangeText, type RangeWeights } from "@/lib/handRange/rangeText";
import type { PostflopLine } from "@/lib/share/spotLink";
import type { StreetSolveInputs } from "./streetStages";
import type { RangeSeat } from "./RangeReview";

/** The ranges the user entered in place of the chart's, by seat; a seat left out keeps the chart's. */
export type RangeEdits = Partial<Record<RangeSeat, RangeWeights>>;

const SEATS: RangeSeat[] = ["P1", "P2"];

/** The edits a link carries; a range it can't read keeps the chart's. */
export function rangeEditsFromLine(line: PostflopLine | undefined): RangeEdits {
  const edits: RangeEdits = {};
  for (const seat of SEATS) {
    const text = line?.ranges?.[seat];
    if (!text) continue;
    const parsed = parseRangeText(text);
    if (parsed.ok) edits[seat] = parsed.weights;
  }
  return edits;
}

/** The edits as a link writes them, or nothing with none. */
export function rangeEditsToLine(edits: RangeEdits): Pick<PostflopLine, "ranges"> {
  const ranges: NonNullable<PostflopLine["ranges"]> = {};
  for (const seat of SEATS) {
    const weights = edits[seat];
    if (weights) ranges[seat] = formatRangeText(weights);
  }
  return Object.keys(ranges).length > 0 ? { ranges } : {};
}

/** Whether two ranges hold the same hands at the same weights, to the two decimals a link keeps. */
export function sameRange(a: RangeWeights, b: RangeWeights): boolean {
  return ALL_HANDS.every(({ hand }) => Math.abs((a.get(hand) ?? 0) - (b.get(hand) ?? 0)) < 0.005);
}

/** The solve's inputs with each edited seat's range in place of the chart's. */
export function withRangeEdits<T extends Pick<StreetSolveInputs, "heroHands" | "heroActionKey" | "villainHands" | "villainActionKey">>(
  inputs: T,
  edits: RangeEdits,
): T {
  return {
    ...inputs,
    ...(edits.P1 && { heroHands: handsOfWeights(edits.P1), heroActionKey: "call" as const }),
    ...(edits.P2 && { villainHands: handsOfWeights(edits.P2), villainActionKey: "call" as const }),
  };
}
