import type { Locale } from "@/lib/i18n/messages";
import type { RangeSource } from "@/types/rangeData";
import { formatPercent } from "@/lib/format";
import type { RangeFormatSlug, SpotPage } from "./spotPages";
import type { ActionKey, EdgeCategory, RangeStats } from "./spotSummary";

/** The words of the /ranges pages, which the server writes out in full: no strings reach the client from here. */
export interface RangeCopy {
  formatShort: Record<RangeFormatSlug, string>;
  formatLong: Record<RangeFormatSlug, string>;
  title: (page: SpotPage, stats: RangeStats) => string;
  heading: (page: SpotPage, stats: RangeStats) => string;
  description: (page: SpotPage, stats: RangeStats) => string;
  summary: (page: SpotPage, stats: RangeStats, source: RangeSource) => string[];
  openInSolver: string;
  howMade: string;
  rangeText: string;
  rangeTextHint: string;
  actionName: Record<Exclude<ActionKey, "fold">, string>;
  otherStacks: (seat: string) => string;
  otherSeats: (stackBb: number) => string;
  allCharts: string;
  index: { title: string; heading: string; description: string; intro: string[]; seat: string };
  browseCharts: string;
}

const pct = formatPercent;

const en: RangeCopy = {
  formatShort: { mtt: "MTT", "cash-6max": "6-Max Cash" },
  formatLong: { mtt: "an 8-handed tournament (chip EV, with ante)", "cash-6max": "a 6-max cash game with rake" },
  title: (p, s) =>
    s.pushFold ? `${p.stackBb}bb ${p.seat} Push/Fold Chart — ${en.formatShort[p.format]}` : `${p.seat} Open Range at ${p.stackBb}bb — ${en.formatShort[p.format]} Preflop Chart`,
  heading: (p, s) => `${p.seat} ${s.pushFold ? "push/fold range" : "open range"} at ${p.stackBb}bb — ${en.formatShort[p.format]}`,
  description: (p, s) =>
    `${p.seat} first-in range at ${p.stackBb}bb in ${en.formatLong[p.format]}: plays ${pct(1 - s.share.fold)} of hands (${s.playedCombos.toFixed(0)} combos). Free chart with every hand's frequency, as text and in a solver.`,
  summary: (p, s, source) => {
    const parts: string[] = [];
    if (s.share.raise > 0.0005) parts.push(`raises ${pct(s.share.raise)}`);
    if (s.share.call > 0.0005) parts.push(`limps ${pct(s.share.call)}`);
    if (s.share.allin > 0.0005) parts.push(`goes all-in with ${pct(s.share.allin)}`);
    const actions = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "plays nothing");
    const lines = [
      `In ${en.formatLong[p.format]} at ${p.stackBb} big blinds, when everyone folds to the ${p.seat}, it ${actions} of all hands and folds the other ${pct(s.share.fold)} (${s.playedCombos.toFixed(0)} of 1,326 combos played).`,
    ];
    if (s.edges.length > 0) lines.push(`It plays ${list(s.edges.map((e) => `${EDGE_EN[e.category]} down to ${e.hand}`), "and")}.`);
    if (s.mixedHands > 0) lines.push(`${s.mixedHands} ${s.mixedHands === 1 ? "hand is" : "hands are"} played only part of the time; tap a cell to see its exact split.`);
    lines.push(
      source === "nash-shove-fold"
        ? "At this depth the range is an exact push/fold Nash equilibrium for the stack, the blinds and the ante."
        : "The range is estimated: built from charts tuned so their frequencies match solver output, not solved on the spot.",
    );
    return lines;
  },
  openInSolver: "Open this spot in the solver",
  howMade: "How these ranges are made",
  rangeText: "Range as text",
  rangeTextHint: "The format the solver's range editor reads; select and copy.",
  actionName: { raise: "Raise", call: "Limp", allin: "All-in" },
  otherStacks: (seat) => `${seat} at other stacks`,
  otherSeats: (stackBb) => `Other seats at ${stackBb}bb`,
  allCharts: "All preflop charts",
  index: {
    title: "Preflop Range Charts — MTT Push/Fold & 6-Max Cash Opens",
    heading: "Preflop range charts",
    description:
      "Free preflop charts for every seat: 8-handed tournament open and push/fold ranges from 10 to 100bb, and 6-max cash opening ranges at 100bb with rake.",
    intro: [
      "Each chart is the range a seat plays when everyone folds to it, the same one the solver shows for that spot. Pick a format, a stack and a seat.",
      "From 15bb down, the ranges are push/fold Nash solves; deeper, they are estimated from charts tuned to solver output.",
    ],
    seat: "Seat",
  },
  browseCharts: "Browse preflop charts by seat and stack",
};

const EDGE_EN: Record<EdgeCategory, string> = {
  pairs: "pairs",
  suitedAces: "suited aces",
  offsuitAces: "offsuit aces",
  suitedKings: "suited kings",
  offsuitKings: "offsuit kings",
};

const EDGE_KO: Record<EdgeCategory, string> = {
  pairs: "페어",
  suitedAces: "수딧 에이스",
  offsuitAces: "오프수딧 에이스",
  suitedKings: "수딧 킹",
  offsuitKings: "오프수딧 킹",
};

const ko: RangeCopy = {
  formatShort: { mtt: "토너먼트", "cash-6max": "6맥스 캐시" },
  formatLong: { mtt: "8인 토너먼트(칩 EV, 앤티 있음)", "cash-6max": "레이크가 있는 6맥스 캐시 게임" },
  title: (p, s) =>
    s.pushFold ? `${p.stackBb}bb ${p.seat} 푸시/폴드 차트 — ${ko.formatShort[p.format]}` : `${p.stackBb}bb ${p.seat} 오픈 레인지 — ${ko.formatShort[p.format]} 프리플랍 차트`,
  heading: (p, s) => `${p.stackBb}bb ${p.seat} ${s.pushFold ? "푸시/폴드 레인지" : "오픈 레인지"} — ${ko.formatShort[p.format]}`,
  description: (p, s) =>
    `${ko.formatLong[p.format]} ${p.stackBb}bb에서 ${p.seat}까지 폴드됐을 때의 레인지: 전체 핸드의 ${pct(1 - s.share.fold)}(${s.playedCombos.toFixed(0)}콤보)를 플레이합니다. 핸드별 빈도를 차트와 텍스트, 솔버로 무료로 확인하세요.`,
  summary: (p, s, source) => {
    const parts: string[] = [];
    if (s.share.raise > 0.0005) parts.push(`${pct(s.share.raise)} 레이즈`);
    if (s.share.call > 0.0005) parts.push(`${pct(s.share.call)} 림프`);
    if (s.share.allin > 0.0005) parts.push(`${pct(s.share.allin)} 올인`);
    const lines = [
      `${ko.formatLong[p.format]} ${p.stackBb}빅블라인드에서 ${p.seat}까지 모두 폴드하면 전체 핸드 중 ${parts.join(", ") || "0%"}하고 나머지 ${pct(s.share.fold)}는 폴드합니다(1,326콤보 중 ${s.playedCombos.toFixed(0)}콤보 플레이).`,
    ];
    if (s.edges.length > 0) lines.push(`가장 약하게 플레이하는 핸드는 ${s.edges.map((e) => `${EDGE_KO[e.category]} ${e.hand}`).join(", ")}입니다.`);
    if (s.mixedHands > 0) lines.push(`${s.mixedHands}개 핸드는 일부 빈도로만 플레이합니다. 칸을 누르면 정확한 비율이 보입니다.`);
    lines.push(
      source === "nash-shove-fold"
        ? "이 스택에서는 스택, 블라인드, 앤티에 맞춰 정확히 푼 푸시/폴드 내시 균형입니다."
        : "이 레인지는 추정값입니다. 빈도가 솔버 결과와 맞도록 조정한 차트로 만들었으며, 그 자리에서 푼 값은 아닙니다.",
    );
    return lines;
  },
  openInSolver: "솔버에서 이 스팟 열기",
  howMade: "레인지를 만드는 방법",
  rangeText: "레인지 텍스트",
  rangeTextHint: "솔버의 레인지 편집기가 읽는 형식입니다. 선택해서 복사하세요.",
  actionName: { raise: "레이즈", call: "림프", allin: "올인" },
  otherStacks: (seat) => `다른 스택의 ${seat}`,
  otherSeats: (stackBb) => `${stackBb}bb의 다른 자리`,
  allCharts: "프리플랍 차트 전체",
  index: {
    title: "프리플랍 레인지 차트 — 토너먼트 푸시/폴드, 6맥스 캐시 오픈",
    heading: "프리플랍 레인지 차트",
    description:
      "모든 자리의 무료 프리플랍 차트: 10~100bb 8인 토너먼트 오픈·푸시/폴드 레인지와 레이크가 있는 100bb 6맥스 캐시 오픈 레인지.",
    intro: [
      "각 차트는 그 자리까지 모두 폴드했을 때 플레이하는 레인지로, 솔버가 같은 스팟에서 보여주는 것과 같습니다. 포맷, 스택, 자리를 고르세요.",
      "15bb 이하는 푸시/폴드 내시 솔브이고, 그보다 깊으면 솔버 결과에 맞춘 차트로 추정한 값입니다.",
    ],
    seat: "자리",
  },
  browseCharts: "자리와 스택별 프리플랍 차트 보기",
};

function list(items: string[], conjunction: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}

const COPY: Record<Locale, RangeCopy> = { en, ko };

export function rangeCopy(locale: Locale): RangeCopy {
  return COPY[locale];
}
