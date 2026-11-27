import { describe, expect, it } from "vitest";
import { loadEquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { HAND_BY_LABEL } from "@/lib/handRange/handList";
import type { ActionType, HandFrequency, Position } from "@/types/rangeData";
import { gameFormatById, TOURNAMENT_8, type GameFormat } from "./gameFormat";
import { initialPotState, applyAction, type PotState } from "./potState";
import { DEFAULT_RAKE_SETTINGS, NO_RAKE_SETTINGS } from "./rake";
import { replayActionPath } from "./replay";
import { solveActiveSeat } from "./solve";
import { equityOf } from "@/lib/equity/loadEquityMatrix";
import { aggressiveFrequencies } from "./postflopHandoff";
import { weightedEquityVsRange } from "@/lib/nashSolver/pushFoldSolver";

const matrix = loadEquityMatrix();

function combosWith(hands: HandFrequency[], freq: (h: HandFrequency) => number): number {
  return hands.reduce((sum, h) => sum + freq(h) * HAND_BY_LABEL.get(h.hand)!.combos, 0);
}

describe("solveActiveSeat", () => {
  it("opens mostly with raises above the flat Nash threshold", () => {
    const result = solveActiveSeat(matrix, "BTN", initialPotState(), 20);
    expect(result.source).toBe("heuristic-approx");
    const raises = combosWith(result.hands, (h) => h.raise);
    const jams = combosWith(result.hands, (h) => h.allin ?? 0);
    expect(jams).toBeGreaterThan(0);
    expect(jams).toBeLessThan(raises / 3);
    expect((raises + jams) / 1326).toBeCloseTo(0.42, 1);
  });

  it("defends the raked cash BB against a button open with suited connectors before offsuit hands the open dominates", () => {
    const format = gameFormatById("cash-6")!;
    const path = (["LJ", "HJ", "CO"] as Position[]).map((actor) => ({ actor, action: "fold" as ActionType }));
    const replayed = replayActionPath([...path, { actor: "BTN", action: "raise" }, { actor: "SB", action: "fold" }], 100, format);
    if (replayed.status !== "active") throw new Error("BB should act");
    const hands = new Map(solveActiveSeat(matrix, replayed.activeSeat, replayed.potState, 100, DEFAULT_RAKE_SETTINGS).hands.map((h) => [h.hand, h]));
    const played = (hand: string) => 1 - hands.get(hand)!.fold;
    const sum = (list: string[]) => list.reduce((total, hand) => total + played(hand), 0);
    for (const suited of ["65s", "75s", "86s"]) expect(played(suited)).toBeGreaterThan(0.9);
    expect(sum(["J9o", "Q9o", "T9o"])).toBeLessThan(sum(["65s", "75s", "86s"]) - 1);
  });

  it("in cash 6-max, has the BB flat some middle pairs against a button open and the button flat more of the 3-bet than 8-max does", () => {
    const at = (formatId: string, ...moves: string[]) => {
      const format = gameFormatById(formatId)!;
      const folds = (format.absentSeats?.includes("UTG") ? ["LJ", "HJ", "CO"] : ["UTG", "UTG1", "LJ", "HJ", "CO"]).map((actor) => ({ actor: actor as Position, action: "fold" as ActionType }));
      const path = [...folds, ...moves.map((m) => { const [actor, action] = m.split(":"); return { actor: actor as Position, action: action as ActionType }; })];
      const result = replayActionPath(path, 100, format);
      if (result.status !== "active") throw new Error("expected a seat to act");
      return new Map(solveActiveSeat(matrix, result.activeSeat, result.potState, 100, DEFAULT_RAKE_SETTINGS).hands.map((h) => [h.hand, h]));
    };
    const bb6 = at("cash-6", "BTN:raise", "SB:fold");
    expect(bb6.get("88")!.call).toBeGreaterThan(0.5);
    expect(bb6.get("AA")!.raise).toBe(1);
    const btn6 = at("cash-6", "BTN:raise", "SB:fold", "BB:raise");
    const btn8 = at("cash-8", "BTN:raise", "SB:fold", "BB:raise");
    for (const hand of ["99", "88", "TT"]) expect(btn6.get(hand)!.call).toBeGreaterThan(btn8.get(hand)!.call);
  });

  it("defends the BB against a button open with most of its hands, far more than the seats that don't close the action", () => {
    const state = (...seats: Position[]) =>
      seats.reduce(
        (s, seat) =>
          seat === "BTN"
            ? applyAction(s, seat, "raise", { effectiveStackBb: 40, raiseToBb: 2 })
            : applyAction(s, seat, "fold", { effectiveStackBb: 40 }),
        initialPotState(),
      );
    const fold = (seat: Position, s: PotState) => combosWith(solveActiveSeat(matrix, seat, s, 40).hands, (h) => h.fold) / 1326;
    const toSb = state("UTG", "UTG1", "LJ", "HJ", "CO", "BTN");
    expect(fold("BB", applyAction(toSb, "SB", "fold", { effectiveStackBb: 40 }))).toBeLessThan(0.3);
    expect(fold("SB", toSb)).toBeGreaterThan(0.6);
  });

  it("routes a shallow-stack opening spot to Nash and produces allin-only frequencies", () => {
    const result = solveActiveSeat(matrix, "UTG", initialPotState(), 14);
    expect(result.source).toBe("nash-shove-fold");
    for (const h of result.hands) {
      expect(h.call).toBe(0);
      expect(h.raise).toBe(0);
      expect(h.fold + (h.allin ?? 0)).toBeCloseTo(1, 6);
    }
    const aa = result.hands.find((h) => h.hand === "AA")!;
    expect(aa.allin).toBeGreaterThan(0.9);
  });

  it("shoves tighter the more players are left to act: UTG < BTN", () => {
    const shoves = (seat: "UTG" | "BTN") => combosWith(solveActiveSeat(matrix, seat, initialPotState(), 10).hands, (h) => h.allin ?? 0);
    expect(shoves("UTG")).toBeLessThan(shoves("BTN"));
    expect(shoves("UTG") / 1326).toBeLessThan(0.25);
  });

  it("calls an UTG shove tighter than a SB shove", () => {
    const calls = (shover: "UTG" | "SB") => {
      const state = applyAction(initialPotState(), shover, "allin", { effectiveStackBb: 10 });
      return combosWith(solveActiveSeat(matrix, "BB", state, 10).hands, (h) => h.call);
    };
    expect(calls("UTG")).toBeLessThan(calls("SB"));
  });

  it("routes a 100bb opening spot to the heuristic engine and produces raise-only frequencies (non-SB — SB splits three ways)", () => {
    const result = solveActiveSeat(matrix, "BTN", initialPotState(), 100);
    expect(result.source).toBe("heuristic-approx");
    for (const h of result.hands) {
      expect(h.call).toBe(0);
      expect(h.allin ?? 0).toBe(0);
      expect(h.fold + h.raise).toBeCloseTo(1, 6);
    }
  });

  const foldedToSb = (stackBb: number) =>
    (["UTG", "UTG1", "LJ", "HJ", "CO", "BTN"] as Position[]).reduce(
      (state, seat) => applyAction(state, seat, "fold", { effectiveStackBb: stackBb }),
      initialPotState(),
    );

  it("splits SB's first-in range into raises, limps and folds, mostly limps", () => {
    for (const stackBb of [20, 40, 100]) {
      const result = solveActiveSeat(matrix, "SB", foldedToSb(stackBb), stackBb);
      expect(result.source).toBe("heuristic-approx");
      for (const h of result.hands) expect(h.fold + h.call + h.raise + (h.allin ?? 0)).toBeCloseTo(1, 6);
      const raises = combosWith(result.hands, (h) => h.raise + (h.allin ?? 0));
      const limps = combosWith(result.hands, (h) => h.call);
      expect(limps).toBeGreaterThan(raises);
      expect((raises + limps) / 1326).toBeGreaterThan(0.75);
      // The raises are partly spread over everything it plays, so even AA limps some, but it raises more than most.
      const aa = result.hands.find((h) => h.hand === "AA")!;
      expect(aa.fold).toBe(0);
      expect(aa.raise + (aa.allin ?? 0)).toBeGreaterThan(raises / (raises + limps));
    }
  });

  it("stays push/fold for SB at the Nash stacks, where limping isn't offered", () => {
    const result = solveActiveSeat(matrix, "SB", foldedToSb(14), 14);
    expect(result.source).toBe("nash-shove-fold");
    expect(combosWith(result.hands, (h) => h.call)).toBe(0);
  });

  it("has BB raise or check behind a limp, never fold", () => {
    const limped = applyAction(foldedToSb(40), "SB", "call", { effectiveStackBb: 40 });
    const result = solveActiveSeat(matrix, "BB", limped, 40);
    expect(combosWith(result.hands, (h) => h.fold)).toBe(0);
    expect(combosWith(result.hands, (h) => h.raise) / 1326).toBeCloseTo(0.4, 1);
    expect(result.hands.find((h) => h.hand === "AA")!.raise).toBeCloseTo(1, 6);
  });

  it("answers BB's raise over a limp from the hands SB limped", () => {
    const limped = applyAction(foldedToSb(40), "SB", "call", { effectiveStackBb: 40 });
    const limps = solveActiveSeat(matrix, "SB", foldedToSb(40), 40).hands;
    const raised = applyAction(limped, "BB", "raise", { effectiveStackBb: 40, raiseToBb: 3.5 });
    const hands = solveActiveSeat(matrix, "SB", raised, 40).hands;

    // AA limps some of the time, and never folds when that limp is raised.
    expect(limps.find((h) => h.hand === "AA")!.call).toBeGreaterThan(0);
    expect(hands.find((h) => h.hand === "AA")!.fold).toBe(0);
    expect(hands.find((h) => h.hand === "72o")!.fold).toBe(1);
    const kept = combosWith(hands, (h) => 1 - h.fold) / combosWith(limps, (h) => h.call);
    // A 2.5bb raise into 6bb is cheap, the limps now hold some strong hands too, and
    // a 40bb BB raises a slice of every hand over a limp: most of the limps go on.
    expect(kept).toBeGreaterThan(0.3);
    expect(kept).toBeLessThan(0.95);
  });

  it("produces call+raise summing correctly with fold for a deep-stack facing-raise spot", () => {
    const state = applyAction(initialPotState(), "UTG", "raise", { effectiveStackBb: 100, raiseToBb: 4 });
    const result = solveActiveSeat(matrix, "CO", state, 100);
    expect(result.source).toBe("heuristic-approx");
    for (const h of result.hands) {
      expect(h.fold + h.call + h.raise).toBeCloseTo(1, 6);
    }
  });

  it("calls or folds a shove at a low stack-to-pot ratio, even at a stack above the flat threshold", () => {
    let state = applyAction(initialPotState(), "UTG", "raise", { effectiveStackBb: 40, raiseToBb: 4 });
    state = applyAction(state, "BB", "raise", { effectiveStackBb: 40, raiseToBb: 12 });
    // UTG shoves the rest of a 40bb stack over BB's 3-bet — BB now faces a big
    // pot relative to its own remaining stack (28bb behind a 53.5bb pot).
    state = applyAction(state, "UTG", "allin", { effectiveStackBb: 40 });
    const result = solveActiveSeat(matrix, "BB", state, 40);
    expect(combosWith(result.hands, (h) => h.call)).toBeGreaterThan(0);
    for (const h of result.hands) {
      expect(h.raise).toBe(0);
      expect(h.fold + h.call).toBeCloseTo(1, 6);
    }
  });

  describe("facing a re-raise", () => {
    const STACK = 100;
    const play = (...steps: [Position, ActionType][]) => {
      const result = replayActionPath(steps.map(([actor, action]) => ({ actor, action })), STACK, TOURNAMENT_8);
      if (result.status !== "active") throw new Error("expected a seat to act");
      return result;
    };
    const foldsTo = (...seats: Position[]) => seats.map((seat) => [seat, "fold"] as [Position, ActionType]);
    const toBtn = foldsTo("UTG", "UTG1", "LJ", "HJ", "CO");
    const played = (h: HandFrequency) => h.raise + h.call + (h.allin ?? 0);

    it("keeps part of the opening range, and nothing outside it", () => {
      const open = solveActiveSeat(matrix, "BTN", play(...toBtn).potState, STACK).hands;
      const facing = play(...toBtn, ["BTN", "raise"], ["SB", "fold"], ["BB", "raise"]);
      const hands = solveActiveSeat(matrix, "BTN", facing.potState, STACK).hands;

      const openCombos = combosWith(open, played);
      const keptCombos = combosWith(hands, played);
      expect(keptCombos / openCombos).toBeGreaterThan(0.4);
      expect(keptCombos / openCombos).toBeLessThan(0.8);
      hands.forEach((h, i) => {
        if (played(open[i]) === 0) expect(played(h)).toBe(0);
      });
    });

    it("gives a 3-bet range's bluffs up to a 4-bet, keeping its value", () => {
      const facing = play(...toBtn, ["BTN", "raise"], ["SB", "fold"], ["BB", "raise"], ["BTN", "raise"]);
      const threeBet = solveActiveSeat(matrix, "BB", play(...toBtn, ["BTN", "raise"], ["SB", "fold"]).potState, STACK).hands;
      const hands = new Map(solveActiveSeat(matrix, "BB", facing.potState, STACK).hands.map((h) => [h.hand, h]));
      const gaveUp = threeBet.filter((h) => h.raise > 0 && hands.get(h.hand)!.fold === 1);
      expect(gaveUp.length).toBeGreaterThan(0);
      expect(gaveUp.map((h) => h.hand)).not.toContain("AA");
      expect(hands.get("AA")!.fold).toBe(0);
    });

    it("prices a shove over a 4-bet from the real pot, and only from its own range", () => {
      const fourBet = play(["UTG", "raise"], ...foldsTo("UTG1", "LJ", "HJ", "CO"), ["BTN", "raise"], ...foldsTo("SB", "BB"));
      const fourBetHands = solveActiveSeat(matrix, "UTG", fourBet.potState, STACK).hands;
      const shoved = play(["UTG", "raise"], ...foldsTo("UTG1", "LJ", "HJ", "CO"), ["BTN", "raise"], ...foldsTo("SB", "BB"), ["UTG", "raise"], ["BTN", "allin"]);
      const hands = solveActiveSeat(matrix, "UTG", shoved.potState, STACK).hands;

      expect(shoved.potState.potBb).toBeGreaterThan(120);
      expect(hands.find((h) => h.hand === "AA")!.call).toBe(1);
      hands.forEach((h, i) => {
        if (fourBetHands[i].raise === 0) expect(played(h)).toBe(0);
      });
    });

    it("jams its best hands over a 30bb 4-bet that leaves chips behind, and calls with others", () => {
      const line = replayActionPath(
        ["UTG:fold", "UTG1:fold", "LJ:fold", "HJ:fold", "CO:raise", "BTN:fold", "SB:fold", "BB:raise", "CO:raise"].map((s) => {
          const [actor, action] = s.split(":");
          return { actor: actor as Position, action: action as ActionType };
        }),
        30,
        TOURNAMENT_8,
      );
      if (line.status !== "active") throw new Error("expected BB to act");
      expect(line.potState.currentBetToCall).toBeLessThan(30);
      const hands = solveActiveSeat(matrix, "BB", line.potState, 30).hands;
      expect(hands.find((h) => h.hand === "AA")!.allin).toBe(1);
      const jammed = combosWith(hands, (h) => h.allin ?? 0);
      const called = combosWith(hands, (h) => h.call);
      // Its best hands jam; a commercial solver's BB calls off half its 3-bets against a 30bb 4-bet, so calls aren't fewer.
      for (const hand of ["KK", "QQ", "AKs", "AKo"]) expect(hands.find((h) => h.hand === hand)!.allin).toBe(1);
      expect(jammed).toBeGreaterThan(0);
      expect(called).toBeGreaterThan(0);
    });

    it.each([
      ["cash-8", true],
      ["cash-6", false],
    ] as const)("a %s BB facing a cutoff 4-bet calls some of its 3-bets: %s", (formatId, calls) => {
      const line = replayActionPath(
        ["UTG:fold", "UTG1:fold", "LJ:fold", "HJ:fold", "CO:raise", "BTN:fold", "SB:fold", "BB:raise", "CO:raise"]
          .map((s) => {
            const [actor, action] = s.split(":");
            return { actor: actor as Position, action: action as ActionType };
          })
          .filter((p) => !gameFormatById(formatId)!.absentSeats.includes(p.actor)),
        100,
        gameFormatById(formatId)!,
      );
      if (line.status !== "active") throw new Error("expected BB to act");
      const hands = solveActiveSeat(matrix, "BB", line.potState, 100).hands;
      const called = combosWith(hands, (h) => h.call);
      const raised = combosWith(hands, (h) => h.raise + (h.allin ?? 0));
      expect(raised).toBeGreaterThan(0);
      if (calls) expect(called).toBeGreaterThan(raised / 3);
      else expect(called).toBe(0);
    });

    it("keeps a seat that shoved at a call-only node in range", () => {
      const line = replayActionPath(
        ["UTG:raise", "UTG1:fold", "LJ:fold", "HJ:fold", "CO:fold", "BTN:raise", "SB:fold", "BB:fold", "UTG:raise", "BTN:allin"].map((s) => {
          const [actor, action] = s.split(":");
          return { actor: actor as Position, action: action as ActionType };
        }),
        40,
        TOURNAMENT_8,
      );
      if (line.status !== "active") throw new Error("expected UTG to act");
      expect(line.activeSeat).toBe("UTG");
      expect(combosWith(solveActiveSeat(matrix, "UTG", line.potState, 40).hands, played)).toBeGreaterThan(0);
    });

    it("leaves a seat with no range yet on the cold formula", () => {
      const facing = play(["UTG", "raise"], ["UTG1", "raise"]);
      const hands = solveActiveSeat(matrix, "LJ", facing.potState, STACK).hands;
      expect(combosWith(hands, played)).toBeGreaterThan(0);
      expect(hands.find((h) => h.hand === "AA")!.fold).toBe(0);
    });
  });
});

/** SB limps, BB raises, SB re-raises: a line built node by node, so check it holds together. */
describe("the SB's limp-raise", () => {
  const folds = (format: GameFormat) =>
    (["UTG", "UTG1", "LJ", "HJ", "CO", "BTN"] as Position[]).filter((s) => !format.absentSeats.includes(s)).map((actor) => ({ actor, action: "fold" as ActionType }));
  const at = (format: GameFormat, stack: number, moves: [Position, ActionType][]) => {
    const r = replayActionPath([...folds(format), ...moves.map(([actor, action]) => ({ actor, action }))], stack, format);
    if (r.status !== "active") throw new Error("expected a seat to act");
    return { state: r.potState, hands: solveActiveSeat(matrix, r.activeSeat, r.potState, stack).hands };
  };
  const limpRaised: [Position, ActionType][] = [["SB", "call"], ["BB", "raise"]];

  it.each([
    ["cash 8-max", gameFormatById("cash-8")!, 100],
    ["cash 6-max", gameFormatById("cash-6")!, 100],
    ["tournament", TOURNAMENT_8, 100],
  ] as const)("re-raises the %s BB's raise only with hands ahead of it", (_, format, stack) => {
    const bb = at(format, stack, [["SB", "call"]]).hands;
    const bbRaise = new Map(bb.map((h, i) => [h.hand, aggressiveFrequencies(bb)[i]]));
    const sb = at(format, stack, limpRaised).hands;
    for (const h of sb.filter((x) => x.raise > 0)) expect(weightedEquityVsRange(matrix, h.hand, bbRaise), h.hand).toBeGreaterThanOrEqual(0.5);
  });

  it("calls enough of a 100bb tournament limp-raise that the BB can't jam all it would fold", () => {
    const stack = 100;
    const limpRaise = at(TOURNAMENT_8, stack, limpRaised).hands;
    const sbRange = new Map(limpRaise.map((h) => [h.hand, h.raise]));
    const facing = at(TOURNAMENT_8, stack, [...limpRaised, ["SB", "raise"]]);
    const jammed = at(TOURNAMENT_8, stack, [...limpRaised, ["SB", "raise"], ["BB", "allin"]]);
    const calls = new Map(jammed.hands.map((h) => [h.hand, h.call]));
    expect(combosWith(jammed.hands, (h) => h.call * (sbRange.get(h.hand) ?? 0))).toBeGreaterThan(0);
    // What the BB gains by jamming each hand it would fold, over folding it.
    const potBefore = facing.state.potBb;
    const risk = (jammed.state.committed.BB ?? 0) - (facing.state.committed.BB ?? 0);
    const finalPot = jammed.state.potBb + (jammed.state.currentBetToCall - (jammed.state.committed.SB ?? 0));
    const sbCombos = combosWith(limpRaise, (h) => h.raise);
    const gain = (hand: string) => {
      let called = 0;
      let equity = 0;
      for (const h of limpRaise) {
        const w = h.raise * (calls.get(h.hand) ?? 0) * HAND_BY_LABEL.get(h.hand)!.combos;
        called += w;
        equity += w * equityOf(matrix, hand, h.hand);
      }
      const callShare = called / sbCombos;
      return (1 - callShare) * potBefore + callShare * ((equity / called) * finalPot - risk);
    };
    const bbFolds = facing.hands.filter((h) => h.fold > 0.5 && h.hand !== "AA");
    const worst = ["72o", "32o", "T4o"].filter((x) => bbFolds.some((h) => h.hand === x));
    expect(worst).toHaveLength(3);
    for (const hand of worst) expect(gain(hand), hand).toBeLessThan(0);
  });
});


describe("the tournament BB behind a limp", () => {
  it("raises a slice of everything from 15bb deep", () => {
    const at = (stack: number) => {
      const path = [...["UTG", "UTG1", "LJ", "HJ", "CO", "BTN"].map((actor) => ({ actor: actor as Position, action: "fold" as const })), { actor: "SB" as Position, action: "call" as const }];
      const result = replayActionPath(path, stack, TOURNAMENT_8);
      if (result.status !== "active") throw new Error("expected the BB to act");
      return new Map(solveActiveSeat(matrix, "BB", result.potState, stack, NO_RAKE_SETTINGS).hands.map((h) => [h.hand, h.raise]));
    };
    expect(at(100).get("72o")).toBeCloseTo(0.35, 6);
    expect(at(40).get("72o")).toBeCloseTo(0.35, 6);
    expect(at(20).get("72o")).toBeCloseTo(0.35, 6);
  });
});

describe("multiway and cold-calling width", () => {
  const SEATS: Position[] = ["UTG", "UTG1", "LJ", "HJ", "CO", "BTN", "SB", "BB"];
  /** The active seat's hands after `moves` (seat → action; seats not named fold, "?" stops before that seat). */
  const at = (format: GameFormat, stackBb: number, moves: Partial<Record<Position, ActionType | "?">>) => {
    const path: { actor: Position; action: ActionType }[] = [];
    for (const seat of SEATS) {
      if (format.absentSeats?.includes(seat)) continue;
      const move = moves[seat];
      if (move === "?") break;
      path.push({ actor: seat, action: move ?? "fold" });
    }
    const result = replayActionPath(path, stackBb, format);
    if (result.status !== "active") throw new Error("expected a seat to act");
    return solveActiveSeat(matrix, result.activeSeat, result.potState, stackBb, DEFAULT_RAKE_SETTINGS).hands;
  };
  const share = (hands: HandFrequency[], freq: (h: HandFrequency) => number) => combosWith(hands, freq) / 1326;

  it("has a tournament seat that isn't a blind overcall a called open about half as often", () => {
    const moves = { HJ: "raise", CO: "call", BTN: "?" } as const;
    const flats = (format: GameFormat) => share(at(format, 100, moves), (h) => h.call);
    const unscaled = flats({ ...TOURNAMENT_8, overcallFactor: { ...TOURNAMENT_8.overcallFactor, nonBlind: 1 } });
    expect(flats(TOURNAMENT_8) / unscaled).toBeCloseTo(0.5, 1);
  });

  it("has a tournament opener keep less of its range against a squeeze than the factor-free rule does", () => {
    const moves = { HJ: "raise", CO: "call", BTN: "raise" } as const;
    const continues = (format: GameFormat) => share(at(format, 40, moves), (h) => 1 - h.fold);
    expect(continues(TOURNAMENT_8)).toBeLessThan(continues({ ...TOURNAMENT_8, squeezeKeepFactor: { opener: 1, caller: 1 } }) - 0.01);
  });

  it("calls an all-in tighter when another player already called it, since the caller's range has equity too", () => {
    const behindCaller = at(TOURNAMENT_8, 20, { HJ: "raise", CO: "allin", BTN: "call", BB: "?" });
    const headsUp = at(TOURNAMENT_8, 20, { HJ: "raise", CO: "allin", BB: "?" });
    expect(share(behindCaller, (h) => h.call)).toBeLessThan(share(headsUp, (h) => h.call) / 2);
    expect(behindCaller.find((h) => h.hand === "AA")!.call).toBe(1);
  });

  it("has an opener facing a cold 4-bet, with the 3-bettor still to act, keep less than against a lone 4-bet", () => {
    const moves = { HJ: "raise", CO: "raise", BTN: "raise" } as const;
    const continues = (format: GameFormat) => share(at(format, 100, moves), (h) => 1 - h.fold);
    expect(continues(TOURNAMENT_8)).toBeLessThan(continues({ ...TOURNAMENT_8, coldFourBetKeepFactor: undefined }) * 0.5);
  });

  it("weights a tournament cold 3-bet toward offsuit broadways and away from small pairs, keeping its total", () => {
    const moves = { HJ: "raise", BTN: "?" } as const;
    const plain = at({ ...TOURNAMENT_8, coldThreeBetClassWeightsByStack: undefined }, 100, moves);
    const weighted = at(TOURNAMENT_8, 100, moves);
    const raises = (hands: HandFrequency[], list?: string[]) => share(list ? hands.filter((h) => list.includes(h.hand)) : hands, (h) => h.raise);
    expect(raises(weighted)).toBeCloseTo(raises(plain), 6);
    expect(raises(weighted, ["AKo", "AQo", "AJo", "ATo", "KQo", "KJo"])).toBeGreaterThan(raises(plain, ["AKo", "AQo", "AJo", "ATo", "KQo", "KJo"]));
    expect(raises(weighted, ["22", "33", "44", "55"])).toBeLessThan(raises(plain, ["22", "33", "44", "55"]));
    for (const h of weighted) expect(h.fold + h.call + h.raise + (h.allin ?? 0)).toBeCloseTo(1, 9);
    const at40 = (format: GameFormat) => at(format, 40, moves).map((h) => h.raise);
    expect(at40(TOURNAMENT_8)).toEqual(at40({ ...TOURNAMENT_8, coldThreeBetClassWeightsByStack: undefined }));
  });
});

describe("the tournament open ranking", () => {
  const opens = (format: GameFormat, stackBb: number, hands: string[]) => {
    const replayed = replayActionPath([{ actor: "UTG", action: "fold" }, { actor: "UTG1", action: "fold" }], stackBb, format);
    if (replayed.status !== "active") throw new Error("LJ should act");
    const result = new Map(solveActiveSeat(matrix, replayed.activeSeat, replayed.potState, stackBb).hands.map((h) => [h.hand, h]));
    return hands.reduce((sum, hand) => sum + (1 - result.get(hand)!.fold) * HAND_BY_LABEL.get(hand)!.combos, 0);
  };
  const unshifted = { ...TOURNAMENT_8, openPlayabilityShiftByStack: undefined };

  it("leaves the 20bb open on the flop-seeing ranking", () => {
    const smallPairs = ["22", "33", "44", "55", "66"];
    expect(opens(TOURNAMENT_8, 20, smallPairs)).toBeCloseTo(opens(unshifted, 20, smallPairs), 9);
  });

  it("opens the broadways a little more from 40bb up", () => {
    const broadways = ["KJo", "KTo", "QJo", "ATo", "A9o"];
    for (const stackBb of [40, 100]) expect(opens(TOURNAMENT_8, stackBb, broadways)).toBeGreaterThanOrEqual(opens(unshifted, stackBb, broadways));
  });
});
