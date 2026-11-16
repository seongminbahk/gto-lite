import { readableTextColor } from "@/components/PostflopStrategy/postflopColorLegend";
import { ACTION_COLORS } from "./colorLegend";

interface WeightCellProps {
  hand: string;
  /** The hand's share in the range, 0..1. */
  weight: number;
  onClick?: () => void;
}

const FILL = ACTION_COLORS.call;

/** One hand of a range: filled from the bottom as far as its weight. */
export function WeightCell({ hand, weight, onClick }: WeightCellProps) {
  const inRange = weight > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block h-full w-full overflow-hidden rounded-[2px] ${inRange ? "bg-raised" : "bg-sunken"} ${onClick ? "cursor-pointer" : "cursor-default"}`}
      title={`${hand} ${Math.round(weight * 100)}%`}
      data-hand={hand}
      data-weight={weight}
      data-testid="weight-cell"
    >
      {inRange && <div className="absolute inset-x-0 bottom-0" style={{ height: `${weight * 100}%`, backgroundColor: FILL }} />}
      <span
        className={`pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-medium sm:text-[10px] ${inRange ? "" : "text-ink-faint"}`}
        style={inRange && weight >= 0.5 ? { color: readableTextColor(FILL) } : undefined}
      >
        {hand}
      </span>
    </button>
  );
}
