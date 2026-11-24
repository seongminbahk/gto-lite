import type { ActionWeightKey, PostflopSolveRequest } from "@/types/postflopSolver";
import type { HandFrequency } from "@/types/rangeData";
import type { PostflopSolveInput } from "../solvePostflop";
import type { PostflopPlayer } from "../potState";

function actionWeight(key: ActionWeightKey): (hf: HandFrequency) => number {
  return (hf) => hf[key] ?? 0;
}

const raised = (key: ActionWeightKey) => key === "raise" || key === "allin";

/** The player whose range entered on a raise when the other's entered on a call. */
function preflopAggressor(hero: ActionWeightKey, villain: ActionWeightKey): PostflopPlayer | undefined {
  if (raised(hero) && villain === "call") return "P1";
  if (raised(villain) && hero === "call") return "P2";
  return undefined;
}

/** A worker request as solvePostflopStreet's input: a canonical request's action keys become the weight functions that pick its ranges. */
export function toSolveInput(request: PostflopSolveRequest): PostflopSolveInput {
  if (request.kind === "combos") return request;
  const { heroActionKey, villainActionKey, ...rest } = request;
  return {
    ...rest,
    heroActionWeight: actionWeight(heroActionKey),
    villainActionWeight: actionWeight(villainActionKey),
    preflopAggressor: preflopAggressor(heroActionKey, villainActionKey),
  };
}
