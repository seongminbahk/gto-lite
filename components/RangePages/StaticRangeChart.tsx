"use client";

import type { HandFrequency } from "@/types/rangeData";
import { ActionSummaryTiles } from "@/components/ActionSummaryTiles";
import { RangeGrid } from "@/components/RangeGrid/RangeGrid";

/** A range page's chart: the server writes every cell into the HTML, and tapping one shows its split once the page is live. */
export function StaticRangeChart({ hands }: { hands: HandFrequency[] }) {
  return (
    <div className="flex flex-col gap-2">
      <ActionSummaryTiles hands={hands} />
      <RangeGrid scenario={{ hands }} alwaysSquare />
    </div>
  );
}
