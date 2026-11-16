"use client";

import { HandMatrixGrid } from "@/components/RangeGrid/HandMatrixGrid";
import { WeightCell } from "@/components/RangeGrid/WeightCell";
import { rangeCombos, rangeShare, type RangeWeights } from "@/lib/handRange/rangeText";
import { formatPercent } from "@/lib/format";
import { useMessages } from "@/lib/i18n/locale";

export type RangeSeat = "P1" | "P2";

export interface ReviewedRange {
  seat: RangeSeat;
  label: string;
  weights: RangeWeights;
  edited: boolean;
}

interface RangeReviewProps {
  ranges: ReviewedRange[];
  onEdit: (seat: RangeSeat) => void;
  onContinue: () => void;
}

/** Both ranges before the flop is picked: carry on with them, or open one to change it. */
export function RangeReview({ ranges, onEdit, onContinue }: RangeReviewProps) {
  const t = useMessages();
  return (
    <section data-testid="range-review" className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div>
        <h3 className="text-sm font-medium text-ink">{t.ranges.title}</h3>
        <p className="text-xs text-ink-muted">{t.ranges.hint}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-rows-[minmax(0,1fr)]">
        {ranges.map((range) => (
          <div key={range.seat} data-testid={`range-${range.seat}`} className="flex flex-col gap-1.5 lg:min-h-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-ink">{range.label}</span>
              <span className={`text-xs ${range.edited ? "text-accent" : "text-ink-muted"}`}>{range.edited ? t.ranges.edited : t.ranges.chart}</span>
              <span className="text-xs tabular-nums text-ink-muted">
                {t.ranges.size(rangeCombos(range.weights).toFixed(0), formatPercent(rangeShare(range.weights)))}
              </span>
              <button
                type="button"
                onClick={() => onEdit(range.seat)}
                className="ml-auto rounded border border-line-strong px-2 py-0.5 text-xs text-ink hover:bg-raised pointer-coarse:min-h-11"
              >
                {t.ranges.edit(range.label)}
              </button>
            </div>
            <div className="lg:min-h-0 lg:flex-1">
              <HandMatrixGrid
                fitHeight
                legend={[]}
                renderCell={(hand) => <WeightCell hand={hand} weight={range.weights.get(hand) ?? 0} onClick={() => onEdit(range.seat)} />}
              />
            </div>
          </div>
        ))}
      </div>
      {/* On a phone the two grids stack taller than the screen, so the way on stays in reach at its bottom. */}
      <button
        type="button"
        onClick={onContinue}
        className="sticky bottom-2 shrink-0 rounded bg-accent px-3 py-2 text-sm font-medium text-canvas shadow-lg pointer-coarse:min-h-11 lg:static lg:shadow-none"
      >
        {t.ranges.continue}
      </button>
    </section>
  );
}

interface RangeSummaryLineProps {
  ranges: ReviewedRange[];
  onReview: () => void;
}

/** Above the flop picker: which ranges it will solve with, and the way back to them. */
export function RangeSummaryLine({ ranges, onReview }: RangeSummaryLineProps) {
  const t = useMessages();
  return (
    <p data-testid="range-summary" className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
      <span>{ranges.map((range) => t.ranges.summary(range.label, range.edited)).join(" · ")}</span>
      <button type="button" onClick={onReview} className="text-accent underline-offset-2 hover:underline">
        {t.ranges.review}
      </button>
    </p>
  );
}
