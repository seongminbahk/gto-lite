"use client";

import { useEffect, useRef } from "react";
import { PostflopRangeGrid } from "@/components/PostflopStrategy/PostflopRangeGrid";
import { BetSizeFilterBar } from "@/components/PostflopStrategy/BetSizeFilterBar";
import { SuitedComboBreakdown } from "@/components/PostflopStrategy/SuitedComboBreakdown";
import { buildActionColorScale } from "@/components/PostflopStrategy/postflopColorLegend";
import { ValueRangeGrid } from "@/components/PostflopStrategy/ValueRangeGrid";
import { EquityDistributionChart } from "@/components/PostflopStrategy/EquityDistributionChart";
import type { RangeView } from "@/lib/postflopSolver/handValues";
import { useMessages } from "@/lib/i18n/locale";
import type { SerializedCombo, SerializedDecisionNode } from "@/types/postflopSolver";

const VIEWS: RangeView[] = ["strategy", "ev", "equity", "eqr"];

interface DecisionStrategyViewProps {
  node: SerializedDecisionNode;
  /** The acting player's range arriving at this node. */
  range: SerializedCombo[];
  /** The other player's range arriving at this node. */
  opponentRange: SerializedCombo[];
  board: string[];
  heroLabel: string;
  villainLabel: string;
  selectedHand: string | null;
  onSelectHand: (hand: string | null) => void;
  isolatedActionIndex: number | null;
  onIsolateChange: (index: number | null) => void;
  view: RangeView;
  onViewChange: (view: RangeView) => void;
  /** A tournament hand, whose EVs are prize money read as bb. */
  icm?: boolean;
}

/**
 * A decision node's strategy: the size filter and range grid, with the selected
 * hand's combos beside them. The grid can show each hand's EV, equity or
 * equity realization instead, with both ranges' equity distribution below.
 */
export function DecisionStrategyView(props: DecisionStrategyViewProps) {
  const t = useMessages();
  const { node, range, selectedHand } = props;
  const colors = buildActionColorScale(node.actions);
  const hasValues = !!node.comboValues;
  const view = hasValues ? props.view : "strategy";
  const ranges = node.actor === "P1" ? { P1: range, P2: props.opponentRange } : { P1: props.opponentRange, P2: range };

  // Below the chart on small screens, a tapped hand's combos would otherwise sit off-screen.
  const comboDetailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedHand && !window.matchMedia?.("(min-width: 1024px)").matches) {
      comboDetailRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedHand]);
  return (
    <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-2 lg:min-h-0">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t.solve.rangeView} className="flex shrink-0 overflow-hidden rounded border border-line-strong text-xs">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                disabled={v !== "strategy" && !hasValues}
                title={v !== "strategy" && !hasValues ? t.solve.noValues : undefined}
                onClick={() => props.onViewChange(v)}
                className={`px-2.5 py-1 pointer-coarse:min-h-9 disabled:cursor-default disabled:opacity-40 ${
                  view === v ? "bg-raised font-medium text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {t.solve.views[v]}
              </button>
            ))}
          </div>
          {view !== "strategy" && (
            <p className="min-w-0 flex-1 text-xs text-ink-muted" data-testid="value-view-hint">
              {t.solve.viewHints[view]}
              {view === "ev" && props.icm ? ` ${t.solve.icmNote}` : ""}
            </p>
          )}
        </div>
        {view === "strategy" && (
          <BetSizeFilterBar
            node={node}
            range={range}
            colors={colors}
            isolatedActionIndex={props.isolatedActionIndex}
            onIsolateChange={props.onIsolateChange}
          />
        )}
        <div className="lg:min-h-0 lg:flex-1">
          {view === "strategy" ? (
            <PostflopRangeGrid
              range={range}
              node={node}
              colors={colors}
              isolatedActionIndex={props.isolatedActionIndex}
              selectedHand={selectedHand}
              onSelectHand={props.onSelectHand}
            />
          ) : (
            <ValueRangeGrid range={range} node={node} view={view} selectedHand={selectedHand} onSelectHand={props.onSelectHand} />
          )}
        </div>
      </div>
      <div
        ref={comboDetailRef}
        className="flex flex-col gap-3 border-t border-line pt-3 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
      >
        <SuitedComboBreakdown
          selectedHand={selectedHand}
          node={node}
          range={range}
          board={props.board}
          colors={colors}
          heroLabel={props.heroLabel}
          villainLabel={props.villainLabel}
        />
        {hasValues && <EquityDistributionChart node={node} ranges={ranges} labels={{ P1: props.heroLabel, P2: props.villainLabel }} />}
      </div>
    </div>
  );
}
