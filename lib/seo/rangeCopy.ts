import type { Locale } from "@/lib/i18n/messages";
import type { RangeSource } from "@/types/rangeData";
import { formatPercent } from "@/lib/format";
import type { RangeFormatSlug, SpotKind, SpotPage } from "./spotPages";
import type { ActionKey, EdgeCategory, RangeStats } from "./spotSummary";
import type { EdgeQuestion, RangeDiff } from "./spotInsights";

export interface FaqItem {
  question: string;
  answer: string;
}

/** A neighbouring spot and how this one differs from it. */
export interface SpotComparison {
  other: SpotPage;
  diff: RangeDiff;
}

/** What the page's range was solved against: the open's size, facing one. */
export interface SpotContext {
  source: RangeSource;
  openToBb?: number;
}

type ActionName = Record<Exclude<ActionKey, "fold">, string>;

/** The words of the /ranges pages, which the server writes out in full: no strings reach the client from here. */
export interface RangeCopy {
  formatShort: Record<RangeFormatSlug, string>;
  formatLong: Record<RangeFormatSlug, string>;
  title: (page: SpotPage, stats: RangeStats) => string;
  heading: (page: SpotPage, stats: RangeStats) => string;
  description: (page: SpotPage, stats: RangeStats) => string;
  summary: (page: SpotPage, stats: RangeStats, context: SpotContext) => string[];
  openInSolver: string;
  howMade: string;
  rangeText: string;
  rangeTextHint: string;
  actionName: (kind: SpotKind) => ActionName;
  otherStacks: (page: SpotPage) => string;
  otherSeats: (page: SpotPage) => string;
  /** The chip naming a page in the "other seats" list. */
  seatChip: (page: SpotPage) => string;
  related: (page: SpotPage) => string;
  relatedChip: (page: SpotPage) => string;
  allCharts: string;
  compareHeading: string;
  compareLine: (page: SpotPage, c: SpotComparison) => string;
  mixedHeading: string;
  mixedHint: string;
  faqHeading: string;
  faq: (page: SpotPage, stats: RangeStats, edges: EdgeQuestion[], stackComparison: SpotComparison | null) => FaqItem[];
  index: {
    title: string;
    heading: string;
    description: string;
    intro: string[];
    seat: string;
    openHeading: string;
    vsOpenHeading: (stackBb: number) => string;
    defender: string;
    opener: string;
  };
  browseCharts: string;
}

const pct = formatPercent;
const bb = (n: number) => `${Number(n.toFixed(2))}bb`;

const ACTION_EN: Record<SpotKind, ActionName> = {
  open: { raise: "Raise", call: "Limp", allin: "All-in" },
  "vs-open": { raise: "3-bet", call: "Call", allin: "All-in" },
};
const ACTION_KO: Record<SpotKind, ActionName> = {
  open: { raise: "레이즈", call: "림프", allin: "올인" },
  "vs-open": { raise: "3벳", call: "콜", allin: "올인" },
};

/** "the BTN", "the BB against a BTN open". */
const labelEn = (p: SpotPage) => (p.kind === "open" ? `the ${p.seat}` : `the ${p.seat} against a ${p.opener} open`);
/** "BTN", "BTN 오픈에 대한 BB". */
const labelKo = (p: SpotPage) => (p.kind === "open" ? p.seat : `${p.opener} 오픈에 대한 ${p.seat}`);

function actionsEn(s: RangeStats, kind: SpotKind): string {
  const name = kind === "open" ? { raise: "raises", call: "limps" } : { raise: "3-bets", call: "calls" };
  const parts: string[] = [];
  if (s.share.call > 0.0005 && kind === "vs-open") parts.push(`${name.call} ${pct(s.share.call)}`);
  if (s.share.raise > 0.0005) parts.push(`${name.raise} ${pct(s.share.raise)}`);
  if (s.share.call > 0.0005 && kind === "open") parts.push(`${name.call} ${pct(s.share.call)}`);
  if (s.share.allin > 0.0005) parts.push(`goes all-in with ${pct(s.share.allin)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "plays nothing");
}

function actionsKo(s: RangeStats, kind: SpotKind): string {
  const name = ACTION_KO[kind];
  const parts: string[] = [];
  if (s.share.call > 0.0005 && kind === "vs-open") parts.push(`${pct(s.share.call)} ${name.call}`);
  if (s.share.raise > 0.0005) parts.push(`${pct(s.share.raise)} ${name.raise}`);
  if (s.share.call > 0.0005 && kind === "open") parts.push(`${pct(s.share.call)} ${name.call}`);
  if (s.share.allin > 0.0005) parts.push(`${pct(s.share.allin)} ${name.allin}`);
  return parts.join(", ") || "0%";
}

const SOURCE_EN: Record<"exact" | "estimated", string> = {
  exact: "At this depth the range is an exact push/fold Nash equilibrium for the stack, the blinds and the ante (and, under ICM, the payouts).",
  estimated: "The range is estimated: built from charts tuned so their frequencies match solver output, not solved on the spot.",
};
const SOURCE_KO: Record<"exact" | "estimated", string> = {
  exact: "이 스택에서는 스택, 블라인드, 앤티(ICM이면 상금 구조까지)에 맞춰 정확히 푼 푸시/폴드 내시 균형입니다.",
  estimated: "이 레인지는 추정값입니다. 빈도가 솔버 결과와 맞도록 조정한 차트로 만들었으며, 그 자리에서 푼 값은 아닙니다.",
};
const sourceKey = (source: RangeSource) => (source === "nash-shove-fold" ? "exact" : "estimated");

const en: RangeCopy = {
  formatShort: { mtt: "MTT", "mtt-bubble": "MTT Bubble (ICM)", "mtt-final-table": "MTT Final Table (ICM)", "cash-6max": "6-Max Cash" },
  formatLong: {
    mtt: "an 8-handed tournament (chip EV, with ante)",
    "mtt-bubble": "an 8-handed tournament on the money bubble (ICM, with ante)",
    "mtt-final-table": "an 8-handed tournament final table (ICM, with ante)",
    "cash-6max": "a 6-max cash game with rake",
  },
  title: (p, s) => {
    if (p.kind === "vs-open") return `${p.seat} vs ${p.opener} Open at ${p.stackBb}bb — ${en.formatShort[p.format]} Defense Chart`;
    return s.pushFold ? `${p.stackBb}bb ${p.seat} Push/Fold Chart — ${en.formatShort[p.format]}` : `${p.seat} Open Range at ${p.stackBb}bb — ${en.formatShort[p.format]} Preflop Chart`;
  },
  heading: (p, s) =>
    p.kind === "vs-open"
      ? `${p.seat} vs ${p.opener} open at ${p.stackBb}bb — ${en.formatShort[p.format]}`
      : `${p.seat} ${s.pushFold ? "push/fold range" : "open range"} at ${p.stackBb}bb — ${en.formatShort[p.format]}`,
  description: (p, s) =>
    p.kind === "vs-open"
      ? `How the ${p.seat} defends against a ${p.opener} open at ${p.stackBb}bb in ${en.formatLong[p.format]}: continues with ${pct(1 - s.share.fold)} of hands (${actionsEn(s, p.kind)}). Free chart with every hand's frequency, as text and in a solver.`
      : `${p.seat} first-in range at ${p.stackBb}bb in ${en.formatLong[p.format]}: plays ${pct(1 - s.share.fold)} of hands (${s.playedCombos.toFixed(0)} combos). Free chart with every hand's frequency, as text and in a solver.`,
  summary: (p, s, { source, openToBb }) => {
    const lines =
      p.kind === "vs-open"
        ? [
            `In ${en.formatLong[p.format]} at ${p.stackBb} big blinds, facing a ${p.opener} open${openToBb ? ` to ${bb(openToBb)}` : ""} with everyone else folding, the ${p.seat} ${actionsEn(s, p.kind)} of all hands and folds the other ${pct(s.share.fold)} (${s.playedCombos.toFixed(0)} of 1,326 combos continue).`,
          ]
        : [
            `In ${en.formatLong[p.format]} at ${p.stackBb} big blinds, when everyone folds to the ${p.seat}, it ${actionsEn(s, p.kind)} of all hands and folds the other ${pct(s.share.fold)} (${s.playedCombos.toFixed(0)} of 1,326 combos played).`,
          ];
    const verb = p.kind === "vs-open" ? "continues with" : "plays";
    if (s.edges.length > 0) lines.push(`It ${verb} ${list(s.edges.map((e) => `${EDGE_EN[e.category]} down to ${e.hand}`), "and")}.`);
    if (s.mixedHands > 0) lines.push(`${s.mixedHands} ${s.mixedHands === 1 ? "hand is" : "hands are"} played only part of the time; tap a cell to see its exact split.`);
    lines.push(SOURCE_EN[sourceKey(source)]);
    return lines;
  },
  openInSolver: "Open this spot in the solver",
  howMade: "How these ranges are made",
  rangeText: "Range as text",
  rangeTextHint: "The format the solver's range editor reads; select and copy.",
  actionName: (kind) => ACTION_EN[kind],
  otherStacks: (p) => (p.kind === "open" ? `${p.seat} at other stacks` : `${p.seat} vs ${p.opener} at other stacks`),
  otherSeats: (p) => (p.kind === "open" ? `Other seats at ${p.stackBb}bb` : `The ${p.seat} against other opens at ${p.stackBb}bb`),
  seatChip: (p) => (p.kind === "open" ? p.seat : `vs ${p.opener}`),
  related: (p) => (p.kind === "open" ? `Defending against the ${p.seat} open` : `The ${p.opener}'s open range`),
  relatedChip: (p) => (p.kind === "open" ? `${p.seat} open` : p.seat),
  allCharts: "All preflop charts",
  compareHeading: "How it differs from the next spot",
  compareLine: (p, { other, diff }) => {
    const against = `${labelEn(other)} at ${other.stackBb}bb`;
    const here = `${labelEn(p)} at ${p.stackBb}bb`;
    if (diff.added.length === 0 && diff.dropped.length === 0) return `Compared with ${against}, ${here} plays the same hands (at least half the time).`;
    const added = diff.added.length > 0 ? `adds ${countEn(diff.added.length)} (${handList(diff.added, "more")})` : "adds none";
    const dropped = diff.dropped.length > 0 ? `drops ${countEn(diff.dropped.length)} (${handList(diff.dropped, "more")})` : "drops none";
    return `Compared with ${against}, ${here} ${added} and ${dropped}.`;
  },
  mixedHeading: "Hands played part of the time",
  mixedHint: "How often each is played; the rest of the time it folds.",
  faqHeading: "Questions",
  faq: (p, s, edges, stackComparison) => {
    const vs = p.kind === "vs-open";
    const how = vs ? `defend against a ${p.opener} open` : s.pushFold ? "go all-in" : "open";
    const withHand = (hand: string) => (vs ? `defend ${hand} against a ${p.opener} open` : s.pushFold ? `go all-in with ${hand}` : `open ${hand}`);
    const items: FaqItem[] = [
      {
        question: `How often does the ${p.seat} ${how} at ${p.stackBb}bb in ${en.formatShort[p.format]}?`,
        answer: vs
          ? `${pct(1 - s.share.fold)} of hands: it ${actionsEn(s, p.kind)}, and folds the other ${pct(s.share.fold)}.`
          : `${pct(1 - s.share.fold)} of hands (${s.playedCombos.toFixed(0)} of 1,326 combos) when everyone folds to it; it folds the other ${pct(s.share.fold)}.`,
      },
    ];
    for (const e of pickEdges(edges)) {
      const below = e.below.played < 0.05 ? `${e.below.hand}, the next one down, is folded.` : `${e.below.hand}, the next one down, is played ${pct(e.below.played)} of the time.`;
      items.push({
        question: `Should the ${p.seat} ${withHand(e.edge.hand)} at ${p.stackBb}bb?`,
        answer: `Yes, ${pct(e.edge.played)} of the time: ${e.edge.hand} is the weakest of the ${EDGE_EN[e.category]} it plays. ${below}`,
      });
    }
    if (stackComparison) {
      items.push({
        question: `How does ${labelEn(p)} change between ${stackComparison.other.stackBb}bb and ${p.stackBb}bb?`,
        answer: en.compareLine(p, stackComparison),
      });
    }
    return items;
  },
  index: {
    title: "Preflop Range Charts — MTT Push/Fold, ICM & 6-Max Cash",
    heading: "Preflop range charts",
    description:
      "Free preflop charts for every seat: 8-handed tournament open and push/fold ranges from 10 to 100bb, the same on the bubble and at the final table under ICM, 6-max cash opening ranges at 100bb with rake, and how each seat defends against an open.",
    intro: [
      "Each chart is the range a seat plays when everyone folds to it, or when one earlier seat has opened, the same one the solver shows for that spot. Pick a format, a stack and a seat.",
      "From 14bb down, the ranges are push/fold Nash solves; deeper, they are estimated from charts tuned to solver output.",
    ],
    seat: "Seat",
    openHeading: "First in (everyone folds to you)",
    vsOpenHeading: (stackBb) => `Facing an open at ${stackBb}bb`,
    defender: "You",
    opener: "Opener",
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
  formatShort: { mtt: "토너먼트", "mtt-bubble": "토너먼트 버블(ICM)", "mtt-final-table": "토너먼트 파이널 테이블(ICM)", "cash-6max": "6맥스 캐시" },
  formatLong: {
    mtt: "8인 토너먼트(칩 EV, 앤티 있음)",
    "mtt-bubble": "8인 토너먼트 머니 버블(ICM, 앤티 있음)",
    "mtt-final-table": "8인 토너먼트 파이널 테이블(ICM, 앤티 있음)",
    "cash-6max": "레이크가 있는 6맥스 캐시 게임",
  },
  title: (p, s) => {
    if (p.kind === "vs-open") return `${p.stackBb}bb ${p.seat} vs ${p.opener} 오픈 대응 레인지 — 홀덤 ${ko.formatShort[p.format]} 프리플랍 차트`;
    return s.pushFold
      ? `${p.stackBb}bb ${p.seat} 푸시/폴드 차트 — 홀덤 ${ko.formatShort[p.format]}`
      : `${p.stackBb}bb ${p.seat} 오픈 레인지 — 홀덤 ${ko.formatShort[p.format]} 프리플랍 차트`;
  },
  heading: (p, s) =>
    p.kind === "vs-open"
      ? `${p.stackBb}bb ${p.seat} vs ${p.opener} 오픈 대응 — ${ko.formatShort[p.format]}`
      : `${p.stackBb}bb ${p.seat} ${s.pushFold ? "푸시/폴드 레인지" : "오픈 레인지"} — ${ko.formatShort[p.format]}`,
  description: (p, s) =>
    p.kind === "vs-open"
      ? `${ko.formatLong[p.format]} ${p.stackBb}bb에서 ${p.opener} 오픈에 대한 ${p.seat}의 대응: 전체 핸드의 ${pct(1 - s.share.fold)}로 계속합니다(${actionsKo(s, p.kind)}). 핸드별 빈도를 홀덤 레인지표와 텍스트, 솔버로 무료로 확인하세요.`
      : `${ko.formatLong[p.format]} ${p.stackBb}bb에서 ${p.seat}까지 폴드됐을 때의 레인지: 전체 핸드의 ${pct(1 - s.share.fold)}(${s.playedCombos.toFixed(0)}콤보)를 플레이합니다. 핸드별 빈도를 홀덤 레인지표와 텍스트, 솔버로 무료로 확인하세요.`,
  summary: (p, s, { source, openToBb }) => {
    const lines =
      p.kind === "vs-open"
        ? [
            `${ko.formatLong[p.format]} ${p.stackBb}빅블라인드, ${p.opener} 오픈${openToBb ? `(${bb(openToBb)})` : ""} 뒤 나머지가 폴드한 상황에서 ${p.seat}의 대응은 전체 핸드 중 ${actionsKo(s, p.kind)}, 나머지 ${pct(s.share.fold)} 폴드입니다(1,326콤보 중 ${s.playedCombos.toFixed(0)}콤보 계속).`,
          ]
        : [
            `${ko.formatLong[p.format]} ${p.stackBb}빅블라인드에서 ${p.seat}까지 모두 폴드하면 전체 핸드 중 ${actionsKo(s, p.kind)}하고 나머지 ${pct(s.share.fold)}는 폴드합니다(1,326콤보 중 ${s.playedCombos.toFixed(0)}콤보 플레이).`,
          ];
    if (s.edges.length > 0) lines.push(`가장 약하게 플레이하는 핸드는 ${s.edges.map((e) => `${EDGE_KO[e.category]} ${e.hand}`).join(", ")}입니다.`);
    if (s.mixedHands > 0) lines.push(`${s.mixedHands}개 핸드는 일부 빈도로만 플레이합니다. 칸을 누르면 정확한 비율이 보입니다.`);
    lines.push(SOURCE_KO[sourceKey(source)]);
    return lines;
  },
  openInSolver: "솔버에서 이 스팟 열기",
  howMade: "레인지를 만드는 방법",
  rangeText: "레인지 텍스트",
  rangeTextHint: "솔버의 레인지 편집기가 읽는 형식입니다. 선택해서 복사하세요.",
  actionName: (kind) => ACTION_KO[kind],
  otherStacks: (p) => (p.kind === "open" ? `다른 스택의 ${p.seat}` : `다른 스택의 ${p.seat} vs ${p.opener}`),
  otherSeats: (p) => (p.kind === "open" ? `${p.stackBb}bb의 다른 자리` : `${p.stackBb}bb ${p.seat}: 다른 자리의 오픈에 대한 대응`),
  seatChip: (p) => (p.kind === "open" ? p.seat : `vs ${p.opener}`),
  related: (p) => (p.kind === "open" ? `${p.seat} 오픈에 대한 대응` : `${p.opener}의 오픈 레인지`),
  relatedChip: (p) => (p.kind === "open" ? `${p.seat} 오픈` : p.seat),
  allCharts: "프리플랍 차트 전체",
  compareHeading: "이웃 스팟과 비교",
  compareLine: (p, { other, diff }) => {
    // Seat names take no particle: Korean readers say them in English, so 은/는 can't be chosen safely.
    const against = `${other.stackBb}bb ${labelKo(other)}`;
    const here = `${p.stackBb}bb ${labelKo(p)}`;
    if (diff.added.length === 0 && diff.dropped.length === 0) return `${against} 대비 ${here}: 플레이하는 핸드(절반 이상 빈도)가 같습니다.`;
    const added = diff.added.length > 0 ? `${diff.added.length}개 핸드 추가(${handList(diff.added, "외")})` : "추가 없음";
    const dropped = diff.dropped.length > 0 ? `${diff.dropped.length}개 제외(${handList(diff.dropped, "외")})` : "제외 없음";
    return `${against} 대비 ${here}: ${added}, ${dropped}.`;
  },
  mixedHeading: "일부 빈도로만 플레이하는 핸드",
  mixedHint: "플레이하는 빈도입니다. 나머지는 폴드합니다.",
  faqHeading: "자주 묻는 질문",
  faq: (p, s, edges, stackComparison) => {
    const vs = p.kind === "vs-open";
    const items: FaqItem[] = [
      vs
        ? {
            question: `${ko.formatShort[p.format]} ${p.stackBb}bb ${p.opener} 오픈에 대한 ${p.seat}의 계속 빈도는 얼마인가요?`,
            answer: `전체 핸드의 ${pct(1 - s.share.fold)}로 계속합니다(${actionsKo(s, p.kind)}). 나머지 ${pct(s.share.fold)}는 폴드합니다.`,
          }
        : {
            question: `${ko.formatShort[p.format]} ${p.stackBb}bb ${p.seat}의 ${s.pushFold ? "올인" : "오픈"} 빈도는 얼마인가요?`,
            answer: `모두 폴드했을 때 전체 핸드의 ${pct(1 - s.share.fold)}(1,326콤보 중 ${s.playedCombos.toFixed(0)}콤보)를 플레이하고, 나머지 ${pct(s.share.fold)}는 폴드합니다.`,
          },
    ];
    for (const e of pickEdges(edges)) {
      const below = e.below.played < 0.05 ? `바로 아래 ${e.below.hand}는 폴드합니다.` : `바로 아래 ${e.below.hand}는 ${pct(e.below.played)} 플레이합니다.`;
      const question = vs
        ? `${p.stackBb}bb ${p.opener} 오픈에 ${p.seat}에서 ${e.edge.hand}로 방어해야 하나요?`
        : `${p.stackBb}bb ${p.seat}에서 ${e.edge.hand}${s.pushFold ? "로 올인" : "를 오픈"}해야 하나요?`;
      items.push({
        question,
        answer: `네, ${pct(e.edge.played)} 플레이합니다. ${e.edge.hand}는 이 레인지에 들어가는 가장 약한 ${EDGE_KO[e.category]}입니다. ${below}`,
      });
    }
    if (stackComparison) {
      items.push({
        question: `${labelKo(p)} 레인지는 ${stackComparison.other.stackBb}bb와 ${p.stackBb}bb에서 어떻게 달라지나요?`,
        answer: ko.compareLine(p, stackComparison),
      });
    }
    return items;
  },
  index: {
    title: "홀덤 프리플랍 차트·레인지표 — 토너먼트 푸시/폴드, ICM, 6맥스 캐시",
    heading: "홀덤 프리플랍 레인지 차트",
    description:
      "모든 자리의 무료 프리플랍 차트: 10~100bb 8인 토너먼트 오픈·푸시/폴드 레인지, ICM 버블·파이널 테이블 레인지, 레이크가 있는 100bb 6맥스 캐시 오픈 레인지, 그리고 오픈에 대한 각 자리의 대응.",
    intro: [
      "각 차트는 그 자리까지 모두 폴드했을 때, 또는 앞자리 한 명이 오픈했을 때 플레이하는 레인지로, 솔버가 같은 스팟에서 보여주는 것과 같습니다. 포맷, 스택, 자리를 고르세요.",
      "14bb 이하는 푸시/폴드 내시 솔브이고, 그보다 깊으면 솔버 결과에 맞춘 차트로 추정한 값입니다.",
    ],
    seat: "자리",
    openHeading: "첫 진입 (앞자리가 모두 폴드)",
    vsOpenHeading: (stackBb) => `${stackBb}bb 오픈에 대한 대응`,
    defender: "내 자리",
    opener: "오픈한 자리",
  },
  browseCharts: "자리와 스택별 프리플랍 차트 보기",
};

const HAND_LIST_MAX = 10;

/** Up to ten hands, then how many more ("A9o, K9o, … and 4 more" / "… 외 4개"). */
function handList(hands: string[], more: "more" | "외"): string {
  const shown = hands.slice(0, HAND_LIST_MAX).join(", ");
  const rest = hands.length - HAND_LIST_MAX;
  if (rest <= 0) return shown;
  return more === "more" ? `${shown} and ${rest} more` : `${shown} 외 ${rest}개`;
}

const countEn = (n: number) => `${n} ${n === 1 ? "hand" : "hands"}`;

/** The rows players ask about most, offsuit first; at most three. */
const EDGE_PRIORITY: EdgeCategory[] = ["offsuitAces", "offsuitKings", "suitedKings", "pairs", "suitedAces"];
function pickEdges(edges: EdgeQuestion[]): EdgeQuestion[] {
  return EDGE_PRIORITY.flatMap((c) => edges.filter((e) => e.category === c)).slice(0, 3);
}

function list(items: string[], conjunction: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}

const COPY: Record<Locale, RangeCopy> = { en, ko };

export function rangeCopy(locale: Locale): RangeCopy {
  return COPY[locale];
}
