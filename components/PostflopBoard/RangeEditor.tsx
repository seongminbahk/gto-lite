"use client";

import { useState } from "react";
import { HandMatrixGrid } from "@/components/RangeGrid/HandMatrixGrid";
import { WeightCell } from "@/components/RangeGrid/WeightCell";
import { formatRangeText, parseRangeText, rangeCombos, rangeShare, type RangeTextError, type RangeWeights } from "@/lib/handRange/rangeText";
import { formatPercent } from "@/lib/format";
import { useMessages } from "@/lib/i18n/locale";

interface RangeEditorProps {
  label: string;
  initial: RangeWeights;
  /** The chart's range, for "back to the chart". */
  chart: RangeWeights;
  onApply: (weights: RangeWeights) => void;
  onCancel: () => void;
}

const BUTTON = "rounded px-3 py-1.5 text-sm pointer-coarse:min-h-11";

/** One seat's range as text and as a grid, each following the other. */
export function RangeEditor({ label, initial, chart, onApply, onCancel }: RangeEditorProps) {
  const t = useMessages();
  const [weights, setWeights] = useState<RangeWeights>(initial);
  const [text, setText] = useState(() => formatRangeText(initial));
  const [error, setError] = useState<{ error: RangeTextError; token: string } | null>(null);

  function show(next: RangeWeights) {
    setWeights(next);
    setText(formatRangeText(next));
    setError(next.size === 0 ? { error: "empty", token: "" } : null);
  }

  function handleText(value: string) {
    setText(value);
    const parsed = parseRangeText(value);
    if (parsed.ok) {
      setWeights(parsed.weights);
      setError(null);
    } else setError({ error: parsed.error, token: parsed.token });
  }

  function toggle(hand: string) {
    const next = new Map(weights);
    if ((next.get(hand) ?? 0) > 0) next.delete(hand);
    else next.set(hand, 1);
    show(next);
  }

  return (
    <section data-testid="range-editor" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-sm font-medium text-ink">{t.ranges.edit(label)}</h3>
        <span className="text-xs tabular-nums text-ink-muted">{t.ranges.size(rangeCombos(weights).toFixed(0), formatPercent(rangeShare(weights)))}</span>
      </div>
      <p className="text-xs text-ink-muted">{t.ranges.editorHint}</p>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t.ranges.text}
        <textarea
          value={text}
          onChange={(e) => handleText(e.target.value)}
          rows={4}
          spellCheck={false}
          aria-invalid={error !== null}
          className="w-full resize-y rounded border border-line-strong bg-sunken p-2 font-mono text-xs text-ink"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-[#d98a82]">
          {t.ranges.errors[error.error](error.token)}
        </p>
      )}
      <div className="mx-auto w-full max-w-md">
        <HandMatrixGrid alwaysSquare legend={[]} renderCell={(hand) => <WeightCell hand={hand} weight={weights.get(hand) ?? 0} onClick={() => toggle(hand)} />} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => show(new Map(chart))} className={`${BUTTON} border border-line-strong text-ink hover:bg-raised`}>
          {t.ranges.reset}
        </button>
        <button type="button" onClick={onCancel} className={`${BUTTON} ml-auto border border-line-strong text-ink hover:bg-raised`}>
          {t.ranges.cancel}
        </button>
        <button
          type="button"
          onClick={() => onApply(weights)}
          disabled={error !== null}
          className={`${BUTTON} bg-accent font-medium text-canvas disabled:opacity-50`}
        >
          {t.ranges.apply}
        </button>
      </div>
    </section>
  );
}
