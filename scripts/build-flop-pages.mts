/**
 * Solves the flops behind the /flops pages with the app's own engine (the same
 * preflop ranges, flop solver and settings a visitor gets) and writes a compact
 * summary to data/flopPages.json. The pages read only that file, so the site
 * build never runs the solver.
 *
 *   npx tsx scripts/build-flop-pages.mts            # every spot and board
 *   ONLY=btn-vs-bb THREADS=8 npx tsx scripts/build-flop-pages.mts
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { loadEquityMatrix } from "@/lib/equity/loadEquityMatrix";
import { replayActionPath } from "@/lib/solveEngine/replay";
import { solveActiveSeat } from "@/lib/solveEngine/solve";
import { gameFormatById } from "@/lib/solveEngine/gameFormat";
import { CHIP_EV } from "@/lib/solveEngine/icm";
import { DEFAULT_RAKE_SETTINGS } from "@/lib/solveEngine/rake";
import { actionPathKey, resolvePostflopHandoff } from "@/lib/solveEngine/postflopHandoff";
import { solvePostflopStreet } from "@/lib/postflopSolver/solvePostflop";
import { serializeCombos, serializeTree } from "@/lib/postflopSolver/serialize";
import { computeCheckdownEquities } from "@/lib/postflopSolver/checkdownEquity";
import { loadNodeThreadedSolverModule } from "@/lib/postflopSolver/wasm/loadNode";
import { toSolveInput } from "@/lib/postflopSolver/worker/solveInput";
import { buildStreetSolveRequest, type StreetSolveInputs } from "@/components/PostflopBoard/streetStages";
import { strengthBuckets, STRENGTH_BUCKETS } from "@/lib/explain/handStrength";
import { FLOP_BOARDS, FLOP_SPOTS, type FlopNodeSummary, type FlopPagesData, type FlopSpotDef } from "@/lib/seo/flopPages";
import type { SerializedCombo, SerializedTreeNode } from "@/types/postflopSolver";
import type { Position } from "@/types/rangeData";

const OUT = "data/flopPages.json";
const THREADS = Number(process.env.THREADS ?? 10);
const ONLY = process.env.ONLY?.split(",");
const STACK = 100;
const format = gameFormatById("cash-6")!;
const rake = DEFAULT_RAKE_SETTINGS;
const matrix = loadEquityMatrix();
const solver = await loadNodeThreadedSolverModule(THREADS);

function inputsFor(spot: FlopSpotDef) {
  const responses: Record<string, ReturnType<typeof solveActiveSeat> & { heroPosition: Position }> = {};
  spot.preflop.forEach((_, i) => {
    const r = replayActionPath(spot.preflop.slice(0, i), STACK, format);
    if (r.status !== "active") throw new Error(`${spot.slug}: no decision at step ${i}`);
    responses[actionPathKey(spot.preflop.slice(0, i))] = { ...solveActiveSeat(matrix, r.activeSeat, r.potState, STACK, rake, CHIP_EV), heroPosition: r.activeSeat };
  });
  const final = replayActionPath(spot.preflop, STACK, format);
  if (final.status !== "resolved") throw new Error(`${spot.slug}: preflop didn't end in a flop`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [p1, p2] = resolvePostflopHandoff(final.canonicalActionPath, final.potState.committed, STACK, responses as any).matchup!;
  const inputs: StreetSolveInputs = {
    heroHands: p1.hands,
    heroActionKey: p1.actionKey,
    villainHands: p2.hands,
    villainActionKey: p2.actionKey,
    startPot: final.potState.potBb,
    effectiveStackBb: Math.min(p1.remainingBb, p2.remainingBb),
    rake: rake.structure,
  };
  return { inputs, seats: { P1: p1.seat, P2: p2.seat } as Record<"P1" | "P2", Position> };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** A decision node as shares of each action, overall and by hand strength. */
function summarize(node: SerializedTreeNode, range: SerializedCombo[], buckets: ReturnType<typeof strengthBuckets>, seat: Position): FlopNodeSummary {
  if (node.type !== "decision") throw new Error("not a decision");
  const actions = node.actions.map((a) => {
    const amount = Number(/([\d.]+)bb/.exec(a.label)?.[1] ?? 0);
    const putIn = a.action === "bet" || a.action === "raise" || a.action === "allin" ? amount : 0;
    return { kind: a.action, bb: putIn ? round(putIn) : undefined, potPct: a.action === "bet" ? Math.round((amount / node.potBb) * 100) : undefined };
  });
  const total = new Array(actions.length).fill(0);
  const byBucket = Object.fromEntries(STRENGTH_BUCKETS.map((b) => [b, { weight: 0, actions: new Array(actions.length).fill(0) as number[] }]));
  let weight = 0;
  range.forEach((c, i) => {
    if (c.weight <= 0 || !buckets[i]) return;
    const s = node.strategy[i] ?? [];
    const b = byBucket[buckets[i]!];
    b.weight += c.weight;
    weight += c.weight;
    s.forEach((p, k) => {
      total[k] += c.weight * p;
      b.actions[k] += c.weight * p;
    });
  });
  return {
    seat,
    potBb: round(node.potBb),
    actions: actions.map((a, k) => ({ ...a, share: round(total[k] / weight) })),
    buckets: Object.fromEntries(
      STRENGTH_BUCKETS.map((b) => [b, { share: round(byBucket[b].weight / weight), actions: byBucket[b].actions.map((x) => round(byBucket[b].weight ? x / byBucket[b].weight : 0)) }]),
    ) as FlopNodeSummary["buckets"],
  };
}

const data: FlopPagesData = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { generatedAt: "", spots: {} };
for (const spot of FLOP_SPOTS) {
  if (ONLY && !ONLY.includes(spot.slug)) continue;
  const { inputs, seats } = inputsFor(spot);
  data.spots[spot.slug] = {};
  for (const board of FLOP_BOARDS) {
    const started = Date.now();
    const request = buildStreetSolveRequest([], 0, board.cards, inputs, false);
    const result = solvePostflopStreet(toSolveInput(request), { solver, threads: THREADS });
    const checkdown = computeCheckdownEquities(result.tree, result.solution, result.heroRange, result.villainRange, result.equityTable, request.rake);
    const tree = serializeTree(result.tree, result.solution, checkdown, result.session?.nextStreetEv());
    result.session?.dispose();
    const oop = serializeCombos(result.heroRange);
    const ip = serializeCombos(result.villainRange);
    const oopBuckets = strengthBuckets(board.cards, oop, ip);
    const ipBuckets = strengthBuckets(board.cards, ip, oop);
    if (tree.type !== "decision" || tree.actor !== "P1") throw new Error("the flop root isn't the first player's");
    const root = summarize(tree, oop, oopBuckets, seats.P1);
    const afterCheck = tree.actions.find((a) => a.action === "check")!.child;
    const ipNode = summarize(afterCheck, ip, ipBuckets, seats.P2);
    // Facing the in-position player's most frequent bet after the check.
    const bets = afterCheck.type === "decision" ? afterCheck.actions.map((a, k) => ({ a, k })).filter(({ a }) => a.action === "bet" || a.action === "allin") : [];
    const top = bets.sort((x, y) => ipNode.actions[y.k].share - ipNode.actions[x.k].share)[0];
    const facing = top ? { ...summarize(top.a.child, oop, oopBuckets, seats.P1), facingBb: ipNode.actions[top.k].bb, facingPotPct: ipNode.actions[top.k].potPct } : null;
    data.spots[spot.slug][board.slug] = { root, afterCheck: ipNode, facingBet: facing };
    console.log(`${spot.slug} ${board.slug} ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
  data.generatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(data));
}
process.exit(0);
