import { HandMatrixGrid } from "@/components/RangeGrid/HandMatrixGrid";
import { formatValue, handValues, valueColor, valueOf, valueScale, VALUE_RAMP, type ValueView } from "@/lib/postflopSolver/handValues";
import type { SerializedCombo, SerializedDecisionNode } from "@/types/postflopSolver";
import { readableTextColor } from "./postflopColorLegend";
import { useMessages } from "@/lib/i18n/locale";

interface ValueRangeGridProps {
  /** The acting player's range — as PostflopRangeGrid's. */
  range: SerializedCombo[];
  node: SerializedDecisionNode;
  view: ValueView;
  selectedHand: string | null;
  onSelectHand: (hand: string | null) => void;
}

/** The acting player's range, each hand colored and labeled by one of its values at this node (EV, equity or EQR). */
export function ValueRangeGrid({ range, node, view, selectedHand, onSelectHand }: ValueRangeGridProps) {
  const t = useMessages();
  const values = handValues(node, node.actor, range);
  const scale = valueScale(view, node.potBb);
  const unit = view === "ev" ? "bb" : "%";

  return (
    <HandMatrixGrid
      legend={[]}
      detail={
        <div className="flex items-center gap-2 text-xs text-ink-muted" data-testid="value-scale">
          <span className="font-mono tabular-nums">{formatValue(scale[0], view)}{unit}</span>
          <span className="h-2 w-24 rounded-[2px]" style={{ background: `linear-gradient(to right, ${VALUE_RAMP.join(", ")})` }} />
          <span className="font-mono tabular-nums">
            {view === "ev" ? t.summary.pot(`${node.potBb.toFixed(1)}bb`) : `${formatValue(scale[1], view)}${unit}${view === "eqr" ? "+" : ""}`}
          </span>
        </div>
      }
      renderCell={(hand) => {
        const value = values.get(hand);
        const shown = value && valueOf(value, view, node.potBb);
        const has = shown !== undefined && Number.isFinite(shown);
        const background = has ? valueColor(shown, scale) : undefined;
        return (
          <button
            type="button"
            disabled={!value}
            onClick={() => onSelectHand(selectedHand === hand ? null : hand)}
            className={`relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[2px] leading-none disabled:cursor-default ${
              value ? "bg-raised" : "bg-sunken text-ink-faint"
            } ${selectedHand === hand ? "ring-[1.5px] ring-accent" : ""}`}
            style={background ? { backgroundColor: background, color: readableTextColor(background) } : undefined}
            title={value ? `${hand}\n${t.solve.views[view]} ${has ? formatValue(shown, view) + unit : "—"}` : `${hand}\n${t.solve.notInRange}`}
            data-hand={hand}
            data-testid="value-hand-cell"
          >
            <span className="text-[9px] font-medium sm:text-[10px]">{hand}</span>
            {value && (
              <span className="hidden font-mono text-[9px] tabular-nums opacity-90 sm:block" data-testid="value-hand-cell-value">
                {has ? formatValue(shown, view) : "—"}
              </span>
            )}
          </button>
        );
      }}
    />
  );
}
