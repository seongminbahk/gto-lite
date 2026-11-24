import type { Locale } from "@/lib/i18n/messages";
import { NOTES, type KnowledgeNote } from "@/lib/explain/knowledge/notes";
import { spotPath, type SpotPage } from "./spotPages";
import { FLOPS_INDEX_PATH } from "./flopPages";

// The /learn page: the concept notes the AI explanation draws on, written for
// this project, shown to readers as one glossary grouped by topic.

export const LEARN_PATH = "/learn";

type Text = Record<Locale, string>;

export interface ConceptLink {
  label: Text;
  path: string;
}

export interface Concept {
  id: string;
  title: Text;
  note: KnowledgeNote;
  links: ConceptLink[];
}

export interface ConceptGroup {
  id: string;
  title: Text;
  concepts: Concept[];
}

const spot = (page: SpotPage) => spotPath(page);
const BTN_OPEN: ConceptLink = { label: { en: "BTN open, 100bb cash", ko: "100bb 캐시 BTN 오픈" }, path: spot({ format: "cash-6max", stackBb: 100, seat: "BTN", kind: "open" }) };
const BB_VS_BTN: ConceptLink = {
  label: { en: "BB vs BTN open, 100bb cash", ko: "100bb 캐시 BTN 오픈에 대한 BB" },
  path: spot({ format: "cash-6max", stackBb: 100, seat: "BB", kind: "vs-open", opener: "BTN" }),
};
const PUSH_10: ConceptLink = { label: { en: "BTN push/fold, 10bb", ko: "10bb BTN 푸시/폴드" }, path: spot({ format: "mtt", stackBb: 10, seat: "BTN", kind: "open" }) };
const SB_OPEN: ConceptLink = { label: { en: "SB first in, 100bb cash", ko: "100bb 캐시 SB 첫 진입" }, path: spot({ format: "cash-6max", stackBb: 100, seat: "SB", kind: "open" }) };
const BUBBLE_10: ConceptLink = {
  label: { en: "CO push/fold on the bubble, 10bb", ko: "버블 10bb CO 푸시/폴드" },
  path: spot({ format: "mtt-bubble", stackBb: 10, seat: "CO", kind: "open" }),
};
const MTT_20: ConceptLink = { label: { en: "BTN open, 20bb MTT", ko: "20bb 토너먼트 BTN 오픈" }, path: spot({ format: "mtt", stackBb: 20, seat: "BTN", kind: "open" }) };

const TITLES: Record<string, Text> = {
  "range-advantage": { en: "Range advantage", ko: "레인지 우위" },
  "nut-advantage": { en: "Nut advantage", ko: "넛 우위" },
  "small-bet": { en: "Small bets", ko: "작은 벳" },
  "big-bet": { en: "Big bets and polarization", ko: "큰 벳과 폴라라이즈" },
  "river-polarization": { en: "River value bets and bluffs", ko: "리버 밸류 벳과 블러프" },
  "bluff-catching": { en: "Bluff catching", ko: "블러프 캐치" },
  "pot-odds-mdf": { en: "Pot odds and minimum defense frequency (MDF)", ko: "팟 오즈와 최소 디펜스 빈도(MDF)" },
  "spr-low": { en: "Low SPR", ko: "낮은 SPR" },
  "spr-mid": { en: "Medium SPR", ko: "중간 SPR" },
  "spr-high": { en: "High SPR", ko: "높은 SPR" },
  "three-bet-pot": { en: "3-bet pots", ko: "3벳 팟" },
  "limped-pot": { en: "Limped pots", ko: "림프 팟" },
  "ip-cbet": { en: "Continuation bets in position", ko: "인 포지션 컨티뉴에이션 벳" },
  "oop-check": { en: "Checking out of position", ko: "아웃 오브 포지션 체크" },
  "check-raise": { en: "Check-raising", ko: "체크레이즈" },
  donk: { en: "Donk bets (leading)", ko: "동크 벳(리드)" },
  "paired-board": { en: "Paired boards", ko: "페어 보드" },
  "monotone-board": { en: "Monotone boards", ko: "모노톤 보드" },
  "connected-board": { en: "Connected boards", ko: "커넥티드 보드" },
  "high-dry-board": { en: "High, dry boards", ko: "하이 드라이 보드" },
  draws: { en: "Draws and semi-bluffs", ko: "드로와 세미 블러프" },
  "turn-card": { en: "How the turn card changes ranges", ko: "턴 카드가 레인지를 바꾸는 방식" },
  icm: { en: "ICM (Independent Chip Model)", ko: "ICM(독립 칩 모델)" },
  rake: { en: "Rake and preflop ranges", ko: "레이크와 프리플랍 레인지" },
  ante: { en: "Antes", ko: "앤티" },
  "push-fold": { en: "Push/fold", ko: "푸시/폴드" },
  "blind-vs-blind": { en: "Blind vs blind", ko: "블라인드 대 블라인드" },
  "oop-raiser": { en: "Preflop raiser out of position", ko: "아웃 오브 포지션 프리플랍 레이저" },
};

const flop = (board: string, en: string, ko: string, spot = "btn-vs-bb"): ConceptLink => ({ label: { en, ko }, path: `${FLOPS_INDEX_PATH}/cash-6max/${spot}/${board}` });

const LINKS: Record<string, ConceptLink[]> = {
  "range-advantage": [flop("a72-rainbow", "A72 rainbow, BTN vs BB", "A72 레인보우, BTN vs BB")],
  "nut-advantage": [flop("986-two-tone", "986 two-tone, BTN vs BB", "986 투톤, BTN vs BB")],
  "small-bet": [flop("k72-rainbow", "K72 rainbow, BTN vs BB", "K72 레인보우, BTN vs BB")],
  "ip-cbet": [flop("k72-rainbow", "K72 rainbow, BTN vs BB", "K72 레인보우, BTN vs BB")],
  "paired-board": [flop("kk7-rainbow", "KK7 rainbow, BTN vs BB", "KK7 레인보우, BTN vs BB")],
  "monotone-board": [flop("a94-monotone", "A94 monotone, BTN vs BB", "A94 모노톤, BTN vs BB")],
  "connected-board": [flop("jt9-two-tone", "JT9 two-tone, BTN vs BB", "JT9 투톤, BTN vs BB")],
  "high-dry-board": [flop("ak5-rainbow", "AK5 rainbow, BTN vs BB", "AK5 레인보우, BTN vs BB")],
  "oop-raiser": [flop("k72-rainbow", "K72 rainbow, BB 3-bet pot", "K72 레인보우, BB 3벳 팟", "bb-3bet-vs-btn")],
  "pot-odds-mdf": [BB_VS_BTN],
  "push-fold": [PUSH_10],
  icm: [BUBBLE_10, MTT_20],
  ante: [MTT_20],
  rake: [BTN_OPEN, BB_VS_BTN],
  "blind-vs-blind": [SB_OPEN],
  "limped-pot": [SB_OPEN],
  "three-bet-pot": [BB_VS_BTN, flop("q94-rainbow", "Q94 rainbow, BB 3-bet pot", "Q94 레인보우, BB 3벳 팟", "bb-3bet-vs-btn")],
};

const GROUPS: { id: string; title: Text; ids: string[] }[] = [
  { id: "ranges", title: { en: "Ranges on the board", ko: "보드 위의 레인지" }, ids: ["range-advantage", "nut-advantage", "turn-card"] },
  {
    id: "betting",
    title: { en: "Bet sizes and lines", ko: "벳 크기와 라인" },
    ids: ["small-bet", "big-bet", "ip-cbet", "oop-check", "check-raise", "donk", "draws", "oop-raiser"],
  },
  { id: "river", title: { en: "River and calling", ko: "리버와 콜" }, ids: ["river-polarization", "bluff-catching", "pot-odds-mdf"] },
  { id: "boards", title: { en: "Board textures", ko: "보드 텍스처" }, ids: ["paired-board", "monotone-board", "connected-board", "high-dry-board"] },
  { id: "stacks", title: { en: "Stacks and pot types", ko: "스택과 팟 종류" }, ids: ["spr-low", "spr-mid", "spr-high", "three-bet-pot", "limped-pot", "blind-vs-blind"] },
  { id: "formats", title: { en: "Tournaments and cash", ko: "토너먼트와 캐시" }, ids: ["push-fold", "icm", "ante", "rake"] },
];

/** Every note in a group, each once; a note no group names goes under the last group. */
export function conceptGroups(): ConceptGroup[] {
  const byId = new Map(NOTES.map((n) => [n.id, n]));
  const named = new Set(GROUPS.flatMap((g) => g.ids));
  const concept = (id: string): Concept => ({ id, title: TITLES[id] ?? { en: id, ko: id }, note: byId.get(id)!, links: LINKS[id] ?? [] });
  const groups = GROUPS.map((g) => ({ id: g.id, title: g.title, concepts: g.ids.filter((id) => byId.has(id)).map(concept) }));
  const rest = NOTES.filter((n) => !named.has(n.id)).map((n) => concept(n.id));
  groups[groups.length - 1].concepts.push(...rest);
  return groups;
}

export const LEARN_COPY: Record<Locale, { title: string; heading: string; description: string; intro: string; contents: string; tryIt: string }> = {
  en: {
    title: "Poker Strategy Concepts — GTO Glossary",
    heading: "Poker strategy concepts",
    description:
      "Short explanations of the ideas behind solver strategies: range and nut advantage, bet sizing, SPR, MDF, board textures, ICM, push/fold and rake, with links to free charts.",
    intro:
      "The ideas a solver's strategy rests on, each in a paragraph. The solver's AI explanation uses the same notes when it explains a hand; the numbers always come from the hand itself.",
    contents: "Contents",
    tryIt: "See it in a chart:",
  },
  ko: {
    title: "홀덤 전략 개념 정리 — GTO 용어집",
    heading: "홀덤 전략 개념",
    description:
      "솔버 전략 뒤에 있는 개념을 짧게 정리했습니다: 레인지·넛 우위, 벳 크기, SPR, MDF, 보드 텍스처, ICM, 푸시/폴드, 레이크. 무료 차트 링크 포함.",
    intro: "솔버 전략의 바탕이 되는 개념을 한 문단씩 정리했습니다. 솔버의 AI 해설도 핸드를 설명할 때 같은 노트를 쓰며, 숫자는 항상 그 핸드에서 나옵니다.",
    contents: "목차",
    tryIt: "차트에서 보기:",
  },
};
