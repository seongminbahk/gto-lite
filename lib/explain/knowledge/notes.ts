import type { FeatureTag } from "./features";

/**
 * Short notes on solver concepts, written for this project in its own words.
 * They give the model the principles behind a strategy; the numbers always
 * come from the hand itself. No note quotes or paraphrases a published
 * article: the repository is public, and so is everything in it.
 */
export interface KnowledgeNote {
  id: string;
  /** The hand features that make this note relevant. */
  tags: FeatureTag[];
  /** Breaks ties between notes matching as many tags: higher comes first. */
  priority: 1 | 2 | 3;
  /** Always included when one of its tags is present (ICM, push/fold): an explanation that missed them would mislead. */
  essential?: boolean;
  en: string;
  ko: string;
}

export const NOTES: KnowledgeNote[] = [
  {
    id: "range-advantage",
    tags: ["range-advantage"],
    priority: 3,
    en: "Range advantage means one range holds more strong hands on this board than the other. The player with it can bet often, even with weak hands, because the opponent cannot continue with enough of their range to punish it. The player without it checks more and defends with the parts of their range that do well on the board.",
    ko: "레인지 우위는 이 보드에서 한쪽 레인지에 강한 핸드가 더 많다는 뜻입니다. 우위가 있는 쪽은 약한 핸드까지 섞어 자주 벳할 수 있습니다. 상대가 레인지의 충분한 부분으로 버티며 응징할 수 없기 때문입니다. 우위가 없는 쪽은 체크를 늘리고, 보드에 잘 맞는 부분으로 디펜스합니다.",
  },
  {
    id: "nut-advantage",
    tags: ["nut-advantage", "overbet"],
    priority: 3,
    en: "Nut advantage is about the very top of the ranges: who holds more of the best hands. It decides bet size more than frequency. A player with more nutted hands can use large bets and overbets, because the opponent's best hands are capped and cannot raise back profitably. Without it, large bets get exploited by the stronger hands the opponent still has.",
    ko: "넛 우위는 레인지의 맨 위, 즉 가장 강한 핸드를 누가 더 많이 가졌는지입니다. 벳 빈도보다 벳 크기를 정합니다. 넛 핸드가 더 많은 쪽은 큰 벳과 오버벳을 쓸 수 있습니다. 상대의 최강 핸드가 제한돼 있어 다시 레이즈로 이득을 보기 어렵기 때문입니다. 넛 우위 없이 크게 벳하면 상대에게 남아 있는 강한 핸드에 당합니다.",
  },
  {
    id: "small-bet",
    tags: ["small-bet", "ip-aggressor-cbet"],
    priority: 2,
    en: "Small bets work when a range advantage is broad but not concentrated at the top. They let a player bet almost the whole range cheaply, charge the many weak hands and draws that would otherwise see a free card, and risk little when called. A small size also makes the opponent defend wide, so medium hands gain value from worse hands.",
    ko: "작은 벳은 레인지 우위가 넓게 퍼져 있지만 맨 위에 몰려 있지 않을 때 효과적입니다. 레인지 거의 전부를 싸게 벳해, 공짜 카드를 보려던 약한 핸드와 드로에게 비용을 물리고, 콜을 받아도 잃는 게 적습니다. 상대가 넓게 디펜스해야 하므로 중간 핸드도 더 약한 핸드에게서 밸류를 얻습니다.",
  },
  {
    id: "big-bet",
    tags: ["big-bet", "overbet"],
    priority: 2,
    en: "Large bets polarize a range: strong value hands and bluffs bet, while medium hands check because they gain little from a big call and lose a lot to a raise. Bluffs need fewer folds to break even at small sizes, but large sizes let the value hands win more, so the bluff share grows with the bet size to keep the opponent indifferent.",
    ko: "큰 벳은 레인지를 폴라라이즈합니다. 강한 밸류 핸드와 블러프가 벳하고, 중간 핸드는 체크합니다. 중간 핸드는 큰 콜에서 얻을 게 적고 레이즈에는 크게 잃기 때문입니다. 벳이 클수록 밸류 핸드가 더 많이 따므로, 상대가 콜과 폴드 사이에서 무차별하도록 블러프 비율도 함께 커집니다.",
  },
  {
    id: "river-polarization",
    tags: ["river"],
    priority: 2,
    en: "On the river no card is left to come, so a hand only bets for value if worse hands call, or as a bluff if better hands fold. Ranges split into value bets, bluffs and checks with showdown value. Bluffs are usually the hands with no showdown value at all, especially those that block the opponent's calling hands.",
    ko: "리버에서는 더 나올 카드가 없으므로, 더 약한 핸드가 콜해 줄 때만 밸류로 벳하고 더 강한 핸드가 폴드할 때만 블러프로 벳합니다. 레인지는 밸류 벳, 블러프, 쇼다운 가치가 있는 체크로 나뉩니다. 블러프로는 보통 쇼다운 가치가 전혀 없는 핸드, 특히 상대의 콜 핸드를 막는 블로커를 가진 핸드를 씁니다.",
  },
  {
    id: "bluff-catching",
    tags: ["river", "facing-bet"],
    priority: 2,
    en: "Facing a river bet, most calling hands are bluff catchers: they beat only bluffs. A player calls just often enough that the bettor's bluffs stop being profitable, and chooses calls by blockers, keeping hands that remove the opponent's value combos and folding those that remove their bluffs.",
    ko: "리버 벳을 마주하면 콜하는 핸드 대부분은 블러프 캐처, 즉 블러프만 이기는 핸드입니다. 상대의 블러프가 이득을 못 볼 만큼만 콜하며, 어떤 핸드로 콜할지는 블로커로 고릅니다. 상대의 밸류 조합을 막는 핸드는 콜하고, 상대의 블러프 조합을 막는 핸드는 폴드합니다.",
  },
  {
    id: "pot-odds-mdf",
    tags: ["facing-bet"],
    priority: 1,
    en: "Pot odds set the equity a call needs: the call divided by the pot after calling. Minimum defense frequency is the other side of it: to stop any bluff from profiting automatically, a player must continue with about pot / (pot + bet) of their range. Real solves defend somewhat less when the range is weak on the board and more when it is strong.",
    ko: "팟 오즈는 콜에 필요한 에쿼티로, 콜 금액을 콜한 뒤 팟 크기로 나눈 값입니다. 최소 디펜스 빈도(MDF)는 그 반대편으로, 어떤 블러프도 자동으로 이득을 보지 못하게 하려면 레인지의 약 팟 ÷ (팟 + 벳)만큼 계속해야 합니다. 실제 솔브에서는 레인지가 보드에 약하면 이보다 덜, 강하면 더 디펜스합니다.",
  },
  {
    id: "spr-low",
    tags: ["spr-low", "allin"],
    priority: 2,
    en: "A low stack-to-pot ratio means the stacks go in within a street or two. Top pairs and strong draws become hands to commit with, fewer bluffs are possible because there is little room to apply pressure, and strategies simplify toward betting or getting all-in with the strong part of the range.",
    ko: "SPR(스택 대비 팟 비율)이 낮으면 한두 스트리트 안에 스택이 다 들어갑니다. 탑 페어와 강한 드로도 스택을 걸 만한 핸드가 되고, 압박할 여지가 적어 블러프는 줄어듭니다. 전략은 레인지의 강한 부분으로 벳하거나 올인하는 쪽으로 단순해집니다.",
  },
  {
    id: "spr-mid",
    tags: ["spr-mid"],
    priority: 1,
    en: "A medium stack-to-pot ratio leaves about two streets of sizable betting. Top pair with a good kicker can usually play for most of the stack, while weaker pairs prefer to keep the pot small. Planning ahead matters: a bet now sets up how much can go in on later streets.",
    ko: "SPR이 중간이면 큰 벳을 두 스트리트 정도 할 여유가 있습니다. 키커가 좋은 탑 페어는 대개 스택 대부분을 걸 수 있고, 더 약한 페어는 팟을 작게 유지하려 합니다. 앞을 내다보는 것이 중요합니다. 지금의 벳이 뒤 스트리트에 얼마나 넣을 수 있는지를 정합니다.",
  },
  {
    id: "spr-high",
    tags: ["spr-high"],
    priority: 1,
    en: "A high stack-to-pot ratio leaves room for three streets of betting. One pair rarely wants to play a big pot, and hands with the potential to become very strong, such as sets, two pairs and strong draws, gain value. Players check more often to control the pot with medium hands.",
    ko: "SPR이 높으면 세 스트리트에 걸쳐 벳할 여유가 있습니다. 원 페어는 큰 팟을 원하지 않는 경우가 많고, 셋, 투 페어, 강한 드로처럼 아주 강해질 수 있는 핸드의 가치가 올라갑니다. 중간 핸드로는 팟을 키우지 않으려고 체크를 더 자주 합니다.",
  },
  {
    id: "three-bet-pot",
    tags: ["3bet-pot", "4bet-pot"],
    priority: 2,
    en: "In a 3-bet pot both ranges are narrower and stronger, and the pot is large against the stacks. The 3-bettor usually holds more overpairs and big aces, so it can bet often on high boards, while the caller's range is capped and has more medium pairs and suited hands that do better on low, connected boards.",
    ko: "3벳 팟에서는 두 레인지 모두 좁고 강하며, 스택에 비해 팟이 큽니다. 3벳한 쪽은 오버페어와 큰 에이스가 많아 높은 보드에서 자주 벳할 수 있습니다. 콜한 쪽은 레인지가 제한돼 있고, 낮고 연결된 보드에 잘 맞는 중간 페어와 수딧 핸드가 더 많습니다.",
  },
  {
    id: "limped-pot",
    tags: ["limped-pot"],
    priority: 2,
    en: "In a limped pot neither range is capped by a raise, so both are wide and similar. Range advantages are small, bets are smaller and less frequent, and the big blind's option to raise preflop means its checked range still holds some strong hands.",
    ko: "림프 팟에서는 레이즈로 제한된 레인지가 없어 두 레인지 모두 넓고 비슷합니다. 레인지 우위가 작아 벳은 작고 덜 자주 나옵니다. 빅 블라인드는 프리플랍에서 레이즈할 수 있었으므로, 체크한 레인지에도 강한 핸드가 일부 남아 있습니다.",
  },
  {
    id: "ip-cbet",
    tags: ["ip-aggressor-cbet", "srp"],
    priority: 2,
    en: "The preflop raiser in position usually has the stronger range on most flops and can continuation bet often. How often and how big depends on the board: frequent small bets where the advantage is broad, fewer and larger bets where the board hits the caller's range or the advantage is concentrated in the nuts.",
    ko: "포지션에 있는 프리플랍 레이저는 대부분의 플랍에서 더 강한 레인지를 가지고 있어 자주 c벳할 수 있습니다. 빈도와 크기는 보드에 따라 다릅니다. 우위가 넓으면 작게 자주, 보드가 콜한 쪽 레인지에 잘 맞거나 우위가 넛에 몰려 있으면 덜 자주 크게 벳합니다.",
  },
  {
    id: "oop-check",
    tags: ["oop-checks-to-aggressor", "oop-aggressor"],
    priority: 1,
    en: "Out of position, a player usually checks most of the range to the player who had the initiative. Checking keeps strong hands in the checking range, so the opponent cannot bet freely, and gives up little because the opponent would bet many hands anyway. Leading is reserved for boards that clearly favor the out-of-position range.",
    ko: "포지션이 없는 쪽은 보통 주도권을 가진 상대에게 레인지 대부분을 체크합니다. 체크하는 레인지에 강한 핸드를 남겨 두면 상대가 마음대로 벳하지 못하고, 상대가 어차피 많은 핸드로 벳할 것이므로 잃는 것도 적습니다. 먼저 벳하는 것은 포지션 없는 쪽 레인지에 확실히 유리한 보드에서만 합니다.",
  },
  {
    id: "check-raise",
    tags: ["check-raise"],
    priority: 3,
    en: "A check-raise turns the checking range into a threat. It is built from strong made hands that want to build the pot and from draws that have equity when called, and it makes the bettor's small, wide bets less profitable. Medium hands rarely check-raise, since they prefer to call and reach showdown.",
    ko: "체크레이즈는 체크하는 레인지를 위협적으로 만듭니다. 팟을 키우고 싶은 강한 완성 핸드와, 콜을 받아도 에쿼티가 있는 드로로 구성되며, 상대의 작고 넓은 벳을 덜 이득이 되게 만듭니다. 중간 핸드는 콜로 쇼다운까지 가는 편이 낫기 때문에 체크레이즈를 거의 하지 않습니다.",
  },
  {
    id: "donk",
    tags: ["donk"],
    priority: 3,
    en: "Leading into the player who had the initiative on the last street is uncommon, but it happens when the new card or board shifts the advantage toward the out-of-position range. The lead is usually small and taken with a mix of hands that improved and hands that want to deny equity.",
    ko: "직전 스트리트의 주도권을 가진 상대에게 먼저 벳하는(동크) 일은 흔하지 않습니다. 하지만 새 카드나 보드가 포지션 없는 쪽 레인지로 우위를 옮길 때 나옵니다. 이런 벳은 보통 작고, 좋아진 핸드와 상대의 에쿼티를 줄이고 싶은 핸드가 섞여 있습니다.",
  },
  {
    id: "paired-board",
    tags: ["board-paired"],
    priority: 2,
    en: "Paired boards are hard to hit: few hands make trips, and most of both ranges hold the same one pair or nothing. The player with more overpairs and high cards can bet small very often. Strong hands are rare, so big bets and raises are rare too.",
    ko: "페어 보드는 맞기가 어렵습니다. 트립스가 되는 핸드는 적고, 두 레인지 대부분이 같은 원 페어이거나 아무것도 없습니다. 오버페어와 높은 카드가 더 많은 쪽이 작게 아주 자주 벳할 수 있습니다. 강한 핸드가 드물어 큰 벳과 레이즈도 드뭅니다.",
  },
  {
    id: "monotone-board",
    tags: ["board-monotone"],
    priority: 2,
    en: "On a monotone board flushes are already possible and a single card of the suit matters a lot. Bets are smaller and less frequent because many hands are vulnerable, and holding the high card of the suit is valuable both as a draw and as a blocker to the nut flush.",
    ko: "모노톤 보드에서는 이미 플러시가 가능하고, 그 무늬 카드 한 장의 의미가 큽니다. 위태로운 핸드가 많아 벳은 작고 덜 자주 나옵니다. 그 무늬의 높은 카드를 가지고 있으면 드로이자 넛 플러시를 막는 블로커로서 가치가 큽니다.",
  },
  {
    id: "connected-board",
    tags: ["board-connected", "board-low"],
    priority: 2,
    en: "Connected and low boards tend to hit the caller's suited connectors, small pairs and two pairs more than the raiser's high cards, though the buckets show whether that holds for these ranges. Where it does, the raiser bets less often, the caller check-raises more, and equities run close, so the turn card can change who is ahead.",
    ko: "연결되거나 낮은 보드는 레이저의 높은 카드보다 콜한 쪽의 수딧 커넥터, 작은 페어, 투 페어에 더 잘 맞는 경향이 있습니다. 다만 이번 레인지에서도 그런지는 버킷으로 확인해야 합니다. 그렇다면 레이저는 덜 자주 벳하고, 콜한 쪽은 체크레이즈를 더 자주 하며, 에쿼티가 비슷해 턴 카드 한 장에 앞선 쪽이 바뀌기도 합니다.",
  },
  {
    id: "high-dry-board",
    tags: ["board-high-dry"],
    priority: 2,
    en: "A dry board with a high card favors the preflop raiser, who holds more of the big pairs and top-pair hands. Few draws exist, so there is little to protect against and a small bet with most of the range is often best.",
    ko: "높은 카드가 있는 마른 보드는 큰 페어와 탑 페어 핸드를 더 많이 가진 프리플랍 레이저에게 유리합니다. 드로가 거의 없어 보호할 것이 적으므로, 레인지 대부분으로 작게 벳하는 것이 최선인 경우가 많습니다.",
  },
  {
    id: "draws",
    tags: ["draws"],
    priority: 1,
    en: "Draws are natural semi-bluffs: they can win by making the opponent fold now or by improving later. The strongest draws bet and raise most, weak draws mostly check or call, and as cards come and the draw misses, it becomes a pure bluff or gives up.",
    ko: "드로는 자연스러운 세미블러프입니다. 지금 상대를 폴드시켜도 이기고, 나중에 완성돼도 이깁니다. 강한 드로가 가장 많이 벳과 레이즈를 하고, 약한 드로는 주로 체크나 콜을 합니다. 카드가 나와도 완성되지 않으면 순수한 블러프가 되거나 포기합니다.",
  },
  {
    id: "turn-card",
    tags: ["turn"],
    priority: 1,
    en: "The turn card shifts the ranges. Cards that pair the board or complete obvious draws often favor the caller; high cards that the raiser's range holds more of favor the raiser. The player whose range improved bets more and larger; on a neutral card, the flop's strategy mostly continues with fewer bluffs.",
    ko: "턴 카드는 레인지의 균형을 바꿉니다. 보드를 페어로 만들거나 뻔한 드로를 완성하는 카드는 콜한 쪽에 유리한 경우가 많고, 레이저 레인지에 더 많은 높은 카드는 레이저에게 유리합니다. 레인지가 좋아진 쪽이 더 자주, 더 크게 벳합니다. 중립적인 카드에서는 플랍 전략이 대체로 이어지되 블러프가 줄어듭니다.",
  },
  {
    id: "icm",
    tags: ["icm"],
    priority: 3,
    essential: true,
    en: "Under ICM, chips lost are worth more than chips won, because busting ends all chance at the remaining prizes. Calling all-in needs much more equity than in chip terms, while the player putting the pressure on can bet and shove wider. The effect is strongest near the bubble and at the final table, and weakest for big stacks facing smaller ones.",
    ko: "ICM에서는 잃는 칩이 따는 칩보다 가치가 큽니다. 탈락하면 남은 상금을 받을 기회가 모두 사라지기 때문입니다. 올인에 콜하려면 칩 기준보다 훨씬 많은 에쿼티가 필요하고, 압박하는 쪽은 더 넓게 벳하고 올인할 수 있습니다. 이 효과는 버블 근처와 파이널 테이블에서 가장 크고, 작은 스택을 상대하는 큰 스택에게는 가장 작습니다.",
  },
  {
    id: "rake",
    tags: ["rake"],
    priority: 2,
    en: "Rake takes a share of every pot that sees a flop, which makes marginal calls and limps worse. Preflop, players fold more of the hands that would just call and prefer to raise or fold. Postflop, the effect is small per pot but pushes close decisions toward folding.",
    ko: "레이크는 플랍까지 간 팟마다 일부를 가져가므로, 애매한 콜과 림프의 가치를 떨어뜨립니다. 프리플랍에서는 그냥 콜하던 핸드를 더 많이 폴드하고, 레이즈 아니면 폴드를 택하게 됩니다. 포스트플랍에서는 팟당 효과는 작지만 비슷한 결정을 폴드 쪽으로 기울게 합니다.",
  },
  {
    id: "ante",
    tags: ["ante"],
    priority: 1,
    en: "An ante adds dead money to every pot, so stealing the blinds is worth more and defending is cheaper. Opening ranges get wider, especially late, and the big blind defends more hands because the price of a call improves.",
    ko: "앤티는 모든 팟에 죽은 돈을 더하므로, 블라인드를 훔치는 가치가 커지고 디펜스하는 비용은 싸집니다. 특히 뒤쪽 자리에서 오픈 레인지가 넓어지고, 콜의 가격이 좋아져 빅 블라인드도 더 많은 핸드로 디펜스합니다.",
  },
  {
    id: "push-fold",
    tags: ["push-fold"],
    priority: 3,
    essential: true,
    en: "With short stacks, raising and then folding to a shove wastes too much of the stack, so the best strategy is all-in or fold. The shove wins the blinds and antes when everyone folds and still has equity when called. Ranges widen the later the position and the shorter the stack.",
    ko: "스택이 짧으면 레이즈한 뒤 올인에 폴드하는 것은 스택을 너무 많이 버리므로, 최선의 전략은 올인 아니면 폴드입니다. 올인은 모두 폴드하면 블라인드와 앤티를 가져가고, 콜을 받아도 에쿼티가 남아 있습니다. 뒤쪽 자리일수록, 스택이 짧을수록 레인지가 넓어집니다.",
  },
  {
    id: "blind-vs-blind",
    tags: ["bvb"],
    priority: 2,
    en: "Blind versus blind, both ranges are wide because the small blind opens against a single player and the big blind gets a good price. The big blind has position for the whole hand, so the small blind plays more cautiously postflop and uses smaller bets.",
    ko: "블라인드 대 블라인드에서는 스몰 블라인드가 한 명만 상대로 오픈하고 빅 블라인드는 좋은 가격을 받으므로 두 레인지 모두 넓습니다. 빅 블라인드가 핸드 내내 포지션을 가지므로, 스몰 블라인드는 포스트플랍에서 더 조심스럽게 플레이하고 작은 벳을 씁니다.",
  },
  {
    id: "oop-raiser",
    tags: ["oop-aggressor"],
    priority: 1,
    en: "A preflop raiser out of position keeps the stronger range but loses the advantage of acting last. It continuation bets less often than it would in position and checks more strong hands, so its checking range is not easy to attack.",
    ko: "포지션 없는 프리플랍 레이저는 더 강한 레인지를 유지하지만 마지막에 행동하는 이점을 잃습니다. 포지션이 있을 때보다 c벳을 덜 하고 강한 핸드도 더 많이 체크하여, 체크한 레인지를 쉽게 공격당하지 않게 합니다.",
  },
];
