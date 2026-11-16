"use client";

import { useState } from "react";
import { equityAtShare, equityDistribution } from "@/lib/postflopSolver/handValues";
import type { PostflopPlayer } from "@/lib/postflopSolver/potState";
import type { SerializedCombo, SerializedDecisionNode } from "@/types/postflopSolver";
import { useMessages } from "@/lib/i18n/locale";

interface EquityDistributionChartProps {
  node: SerializedDecisionNode;
  /** Each player's range arriving at this node, in its solve's combo order. */
  ranges: Record<PostflopPlayer, SerializedCombo[]>;
  labels: Record<PostflopPlayer, string>;
}

/** Categorical slots 1 and 2, stepped for the dark surface. */
const SERIES_COLORS: Record<PostflopPlayer, string> = { P1: "#3987e5", P2: "#d95926" };
const WIDTH = 300;
const HEIGHT = 140;
const PAD = { left: 30, right: 8, top: 8, bottom: 22 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const PLAYERS: PostflopPlayer[] = ["P1", "P2"];

const x = (share: number) => PAD.left + share * PLOT_W;
const y = (equity: number) => PAD.top + (1 - equity) * PLOT_H;

/** A step line through the curve's points, thinned to about one point per pixel. */
function pathOf(curve: { share: number; equity: number }[]): string {
  if (curve.length === 0) return "";
  let d = `M${x(0).toFixed(1)},${y(curve[0].equity).toFixed(1)}`;
  let lastX = -1;
  for (const p of curve) {
    const px = x(p.share);
    if (px - lastX < 1 && p !== curve[curve.length - 1]) continue;
    d += `H${px.toFixed(1)}V${y(p.equity).toFixed(1)}`;
    lastX = px;
  }
  return d;
}

/**
 * Both ranges' equity distributions at a decision node, the curve solvers draw:
 * each range's hands sorted best first, the share of the range across and the
 * equity of the hand at that share up. A crosshair reads both at one share.
 */
export function EquityDistributionChart({ node, ranges, labels }: EquityDistributionChartProps) {
  const t = useMessages();
  const [hoverShare, setHoverShare] = useState<number | null>(null);
  const curves = { P1: equityDistribution(node, "P1", ranges.P1), P2: equityDistribution(node, "P2", ranges.P2) };
  if (curves.P1.length === 0 && curves.P2.length === 0) return null;

  const average = (player: PostflopPlayer) => {
    let weighted = 0;
    let total = 0;
    ranges[player].forEach((combo, i) => {
      const equity = node.comboValues!.equity[player][i];
      if (combo.weight <= 0 || !Number.isFinite(equity)) return;
      weighted += combo.weight * equity;
      total += combo.weight;
    });
    return total > 0 ? weighted / total : undefined;
  };

  function onPointer(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    setHoverShare(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
  }

  return (
    <figure className="flex flex-col gap-1.5" data-testid="equity-distribution">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-semibold text-ink">{t.solve.equityChart}</span>
        <span className="flex gap-3 text-xs text-ink-muted">
          {PLAYERS.map((player) => {
            const avg = average(player);
            return (
              <span key={player} className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES_COLORS[player] }} />
                {avg === undefined ? labels[player] : t.solve.averageEquityOf(labels[player], (avg * 100).toFixed(0))}
              </span>
            );
          })}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={t.solve.equityChartHint}>
        {[0, 0.5, 1].map((e) => (
          <g key={e}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(e)} y2={y(e)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.left - 4} y={y(e) + 3} textAnchor="end" className="fill-ink-faint text-[9px]">
              {e * 100}%
            </text>
          </g>
        ))}
        {[0, 0.5, 1].map((s) => (
          <text key={s} x={x(s)} y={HEIGHT - 8} textAnchor={s === 0 ? "start" : s === 1 ? "end" : "middle"} className="fill-ink-faint text-[9px]">
            {s * 100}%
          </text>
        ))}
        <text x={x(0.5)} y={HEIGHT} textAnchor="middle" className="fill-ink-faint text-[8px]">
          {t.solve.rangeShare}
        </text>
        {PLAYERS.map((player) => (
          <path key={player} d={pathOf(curves[player])} fill="none" stroke={SERIES_COLORS[player]} strokeWidth={2} strokeLinejoin="round" data-testid={`equity-curve-${player}`} />
        ))}
        {hoverShare !== null && (
          <g pointerEvents="none">
            <line x1={x(hoverShare)} x2={x(hoverShare)} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--color-ink-muted)" strokeWidth={1} />
            {PLAYERS.map((player) => {
              const equity = equityAtShare(curves[player], hoverShare);
              return equity === undefined ? null : (
                <circle key={player} cx={x(hoverShare)} cy={y(equity)} r={4} fill={SERIES_COLORS[player]} stroke="var(--color-surface)" strokeWidth={2} />
              );
            })}
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setHoverShare(null)}
        />
      </svg>
      <p className="min-h-4 font-mono text-xs tabular-nums text-ink-muted" aria-live="polite">
        {hoverShare === null
          ? t.solve.equityChartHint
          : PLAYERS.map((player) => {
              const equity = equityAtShare(curves[player], hoverShare);
              return equity === undefined ? null : t.solve.equityAt(labels[player], (hoverShare * 100).toFixed(0), (equity * 100).toFixed(0));
            })
              .filter(Boolean)
              .join(" · ")}
      </p>
    </figure>
  );
}
