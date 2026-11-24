import type { Locale } from "@/lib/i18n/messages";
import type { StrengthBucket } from "@/lib/explain/handStrength";
import { formatPercent } from "@/lib/format";
import type { FaqItem } from "./rangeCopy";
import type { FlopBoardData, FlopNodeSummary, FlopPage } from "./flopPages";

// The words of the /flops pages, written from the solved numbers.

const pct = formatPercent;
type Action = FlopNodeSummary["actions"][number];

export interface FlopCopy {
  boardName: (page: FlopPage) => string;
  potName: (page: FlopPage) => string;
  title: (page: FlopPage) => string;
  heading: (page: FlopPage) => string;
  description: (page: FlopPage, d: FlopBoardData) => string;
  summary: (page: FlopPage, d: FlopBoardData) => string[];
  actionName: (a: Action) => string;
  bucketName: Record<StrengthBucket, string>;
  bucketHint: string;
  rangesHeading: string;
  rangeShare: string;
  nodeHeading: { root: (page: FlopPage) => string; afterCheck: (page: FlopPage) => string; facingBet: (page: FlopPage, d: FlopBoardData) => string };
  overall: string;
  handGroup: string;
  otherBoards: (page: FlopPage) => string;
  otherPot: string;
  openInSolver: string;
  faqHeading: string;
  faq: (page: FlopPage, d: FlopBoardData) => FaqItem[];
  allFlops: string;
  index: { title: string; heading: string; description: string; intro: string[] };
  method: string;
}

const betShare = (n: FlopNodeSummary) => n.actions.filter((a) => a.kind === "bet" || a.kind === "allin" || a.kind === "raise").reduce((s, a) => s + a.share, 0);
const share = (n: FlopNodeSummary, kind: Action["kind"]) => n.actions.filter((a) => a.kind === kind).reduce((s, a) => s + a.share, 0);
const sized = (n: FlopNodeSummary, name: (a: Action) => string) =>
  n.actions
    .filter((a) => (a.kind === "bet" || a.kind === "allin" || a.kind === "raise") && a.share >= 0.005)
    .map((a) => `${name(a)} ${pct(a.share)}`)
    .join(", ");

const SUIT_EN = { rainbow: "rainbow", "two-tone": "two-tone", monotone: "monotone" } as const;
const SUIT_KO = { rainbow: "레인보우", "two-tone": "투톤", monotone: "모노톤" } as const;
const texture = (slug: string) => slug.split("-").slice(1).join("-") as keyof typeof SUIT_EN;
const ranks = (slug: string) => slug.split("-")[0].toUpperCase();

const en: FlopCopy = {
  boardName: (p) => `${ranks(p.board.slug)} ${SUIT_EN[texture(p.board.slug)]}`,
  potName: (p) => (p.spot.threeBet ? `${p.spot.oop} 3-bet vs ${p.spot.ip}` : `${p.spot.ip} vs ${p.spot.oop} single-raised pot`),
  title: (p) => `${ranks(p.board.slug)} ${SUIT_EN[texture(p.board.slug)]} Flop Strategy — ${en.potName(p)}, 100bb Cash`,
  heading: (p) => `${en.boardName(p)} flop (${p.board.cards.join(" ")}): ${en.potName(p)}`,
  description: (p, d) =>
    `How the solver plays ${p.board.cards.join("")} in a 100bb 6-max cash ${p.spot.threeBet ? "3-bet pot" : "single-raised pot"}: the ${d.root.seat} bets ${pct(betShare(d.root))}, the ${d.afterCheck.seat} bets ${pct(betShare(d.afterCheck))} after a check. Strategy by hand strength, free.`,
  summary: (p, d) => {
    const lines = [
      `On ${p.board.cards.join(" ")} the ${d.root.seat} is first to act. It checks ${pct(share(d.root, "check"))}${betShare(d.root) >= 0.005 ? ` and bets ${pct(betShare(d.root))} (${sized(d.root, en.actionName)})` : ""}.`,
      `After a check, the ${d.afterCheck.seat} bets ${pct(betShare(d.afterCheck))}${betShare(d.afterCheck) >= 0.005 ? ` (${sized(d.afterCheck, en.actionName)})` : ""} and checks back ${pct(share(d.afterCheck, "check"))}.`,
    ];
    if (d.facingBet)
      lines.push(
        `Facing the ${d.afterCheck.seat}'s most common bet${d.facingBet.facingPotPct ? ` (${d.facingBet.facingPotPct}% pot)` : ""}, the ${d.facingBet.seat} folds ${pct(share(d.facingBet, "fold"))}, calls ${pct(share(d.facingBet, "call"))} and raises ${pct(betShare(d.facingBet))}.`,
      );
    return lines;
  },
  actionName: (a) =>
    a.kind === "check" ? "Check" : a.kind === "fold" ? "Fold" : a.kind === "call" ? "Call" : a.kind === "allin" ? "All-in" : a.kind === "raise" ? `Raise ${a.bb}bb` : `Bet ${a.potPct}%`,
  bucketName: { nuts: "Nutted", strong: "Strong", medium: "Medium", draw: "Draws", air: "Air" },
  bucketHint: "Hands are grouped by their equity against the other range on this flop: nutted 90%+, strong 70%+, medium 45%+, draws with 8+ outs to a strong hand, and the rest air.",
  rangesHeading: "Who the flop favours",
  rangeShare: "Share of the range",
  nodeHeading: {
    root: (p) => `${p.spot.oop} first to act`,
    afterCheck: (p) => `${p.spot.ip} after a check`,
    facingBet: (p, d) => `${p.spot.oop} facing a ${d.facingBet?.facingPotPct ?? ""}% bet`,
  },
  overall: "Whole range",
  handGroup: "Hands",
  otherBoards: (p) => `Other flops, ${en.potName(p)}`,
  otherPot: "The same flop in the other pot",
  openInSolver: "Open this flop in the solver",
  faqHeading: "Questions",
  faq: (p, d) => {
    const items: FaqItem[] = [
      {
        question: `How often should the ${d.afterCheck.seat} bet ${en.boardName(p)} after a check?`,
        answer: `${pct(betShare(d.afterCheck))} of its range${betShare(d.afterCheck) >= 0.005 ? `: ${sized(d.afterCheck, en.actionName)}` : ""}. It checks back ${pct(share(d.afterCheck, "check"))}.`,
      },
      {
        question: `Should the ${d.root.seat} lead on ${en.boardName(p)}?`,
        answer:
          betShare(d.root) < 0.05
            ? `Rarely: it checks ${pct(share(d.root, "check"))} of its range.`
            : `Sometimes: it bets ${pct(betShare(d.root))} (${sized(d.root, en.actionName)}) and checks the rest.`,
      },
    ];
    if (d.facingBet)
      items.push({
        question: `How often does the ${d.facingBet.seat} defend against a ${d.facingBet.facingPotPct}% bet on ${en.boardName(p)}?`,
        answer: `It continues with ${pct(1 - share(d.facingBet, "fold"))}: calls ${pct(share(d.facingBet, "call"))}, raises ${pct(betShare(d.facingBet))}, folds ${pct(share(d.facingBet, "fold"))}.`,
      });
    return items;
  },
  allFlops: "All flop strategies",
  index: {
    title: "Flop Strategy by Board — 6-Max Cash, Solved",
    heading: "Flop strategy by board",
    description: "How a solver plays 24 common flops in 100bb 6-max cash, single-raised and 3-bet pots: bet frequency, sizes and strategy by hand strength. Free.",
    intro: [
      "Each page is one flop in one pot, solved by this site's own engine with its default preflop ranges and bet sizes: the same result the solver gives for that flop.",
      "Pick a pot and a flop.",
    ],
  },
  method: "Solved with this site's flop solver at its default settings (two bet sizes picked per player from 33/50/75/100% pot, plus all-in where the stacks allow), from its default preflop ranges with rake.",
};

const ko: FlopCopy = {
  boardName: (p) => `${ranks(p.board.slug)} ${SUIT_KO[texture(p.board.slug)]}`,
  potName: (p) => (p.spot.threeBet ? `${p.spot.oop} 3벳 vs ${p.spot.ip}` : `${p.spot.ip} vs ${p.spot.oop} 싱글 레이즈 팟`),
  title: (p) => `${ranks(p.board.slug)} ${SUIT_KO[texture(p.board.slug)]} 플랍 전략 — ${ko.potName(p)}, 홀덤 100bb 캐시`,
  heading: (p) => `${ko.boardName(p)} 플랍(${p.board.cards.join(" ")}): ${ko.potName(p)}`,
  description: (p, d) =>
    `100bb 6맥스 캐시 ${p.spot.threeBet ? "3벳 팟" : "싱글 레이즈 팟"}에서 ${p.board.cards.join("")}을 솔버가 플레이하는 방법: ${d.root.seat} 벳 ${pct(betShare(d.root))}, 체크 뒤 ${d.afterCheck.seat} 벳 ${pct(betShare(d.afterCheck))}. 핸드 강도별 전략을 무료로 확인하세요.`,
  summary: (p, d) => {
    const lines = [
      `${p.board.cards.join(" ")}에서 먼저 행동하는 자리는 ${d.root.seat}입니다. 체크 ${pct(share(d.root, "check"))}${betShare(d.root) >= 0.005 ? `, 벳 ${pct(betShare(d.root))}(${sized(d.root, ko.actionName)})` : ""}입니다.`,
      `체크를 받은 ${d.afterCheck.seat}의 벳은 ${pct(betShare(d.afterCheck))}${betShare(d.afterCheck) >= 0.005 ? `(${sized(d.afterCheck, ko.actionName)})` : ""}, 체크 백은 ${pct(share(d.afterCheck, "check"))}입니다.`,
    ];
    if (d.facingBet)
      lines.push(
        `${d.afterCheck.seat}의 가장 잦은 벳${d.facingBet.facingPotPct ? `(팟의 ${d.facingBet.facingPotPct}%)` : ""}을 받은 ${d.facingBet.seat}의 대응: 폴드 ${pct(share(d.facingBet, "fold"))}, 콜 ${pct(share(d.facingBet, "call"))}, 레이즈 ${pct(betShare(d.facingBet))}.`,
      );
    return lines;
  },
  actionName: (a) =>
    a.kind === "check" ? "체크" : a.kind === "fold" ? "폴드" : a.kind === "call" ? "콜" : a.kind === "allin" ? "올인" : a.kind === "raise" ? `레이즈 ${a.bb}bb` : `벳 ${a.potPct}%`,
  bucketName: { nuts: "넛급", strong: "강함", medium: "중간", draw: "드로", air: "에어" },
  bucketHint: "이 플랍에서 상대 레인지에 대한 에쿼티로 나눴습니다: 넛급 90% 이상, 강함 70% 이상, 중간 45% 이상, 드로는 강한 핸드가 되는 아웃이 8장 이상, 나머지는 에어.",
  rangesHeading: "이 플랍이 누구에게 유리한가",
  rangeShare: "레인지 중 비율",
  nodeHeading: {
    root: (p) => `${p.spot.oop} 먼저 행동`,
    afterCheck: (p) => `체크 뒤 ${p.spot.ip}`,
    facingBet: (p, d) => `${d.facingBet?.facingPotPct ?? ""}% 벳을 받은 ${p.spot.oop}`,
  },
  overall: "레인지 전체",
  handGroup: "핸드",
  otherBoards: (p) => `다른 플랍: ${ko.potName(p)}`,
  otherPot: "다른 팟의 같은 플랍",
  openInSolver: "솔버에서 이 플랍 열기",
  faqHeading: "자주 묻는 질문",
  faq: (p, d) => {
    const items: FaqItem[] = [
      {
        question: `${ko.boardName(p)}에서 체크를 받은 ${d.afterCheck.seat}의 벳 빈도는 얼마인가요?`,
        answer: `레인지의 ${pct(betShare(d.afterCheck))}${betShare(d.afterCheck) >= 0.005 ? `(${sized(d.afterCheck, ko.actionName)})` : ""}를 벳하고 ${pct(share(d.afterCheck, "check"))}는 체크 백합니다.`,
      },
      {
        question: `${ko.boardName(p)}에서 ${d.root.seat}의 선제 벳(리드)은 얼마나 하나요?`,
        answer:
          betShare(d.root) < 0.05
            ? `거의 하지 않습니다. 레인지의 ${pct(share(d.root, "check"))}를 체크합니다.`
            : `일부만 합니다. ${pct(betShare(d.root))}(${sized(d.root, ko.actionName)})를 벳하고 나머지는 체크합니다.`,
      },
    ];
    if (d.facingBet)
      items.push({
        question: `${ko.boardName(p)}에서 ${d.facingBet.facingPotPct}% 벳을 받은 ${d.facingBet.seat}의 디펜스 빈도는 얼마인가요?`,
        answer: `${pct(1 - share(d.facingBet, "fold"))}로 계속합니다: 콜 ${pct(share(d.facingBet, "call"))}, 레이즈 ${pct(betShare(d.facingBet))}, 폴드 ${pct(share(d.facingBet, "fold"))}.`,
      });
    return items;
  },
  allFlops: "플랍 전략 전체",
  index: {
    title: "보드별 홀덤 플랍 전략 — 6맥스 캐시 솔버 결과",
    heading: "보드별 플랍 전략",
    description: "100bb 6맥스 캐시 싱글 레이즈 팟과 3벳 팟에서 자주 나오는 플랍 24개를 솔버가 어떻게 플레이하는지: 벳 빈도, 사이즈, 핸드 강도별 전략. 무료.",
    intro: [
      "각 페이지는 한 팟의 한 플랍을 이 사이트의 엔진으로 기본 프리플랍 레인지와 벳 사이즈 그대로 푼 결과입니다. 솔버에서 같은 플랍을 열면 나오는 결과와 같습니다.",
      "팟과 플랍을 고르세요.",
    ],
  },
  method: "이 사이트의 플랍 솔버 기본 설정(플레이어마다 팟의 33/50/75/100% 중 두 사이즈, 스택이 허락하면 올인 포함)과 레이크가 있는 기본 프리플랍 레인지로 풀었습니다.",
};

const COPY: Record<Locale, FlopCopy> = { en, ko };

export function flopCopy(locale: Locale): FlopCopy {
  return COPY[locale];
}
