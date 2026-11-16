import { z } from "zod";
import packageJson from "@/package.json";
import type { ActionType } from "@/types/rangeData";
import type { SolveErrorBody, SolveErrorCode, SolveRequest, SolveResponse } from "@/types/solveApi";
import { SEAT_ORDER } from "@/lib/actionTree/seatOrder";
import { buildNodeId } from "@/lib/actionTree/nodeId";
import { STACK_MIN_BB, STACK_MAX_BB } from "@/lib/solveEngine/constants";
import { TOURNAMENT_8, gameFormatById, type GameFormat } from "@/lib/solveEngine/gameFormat";
import { NO_RAKE, rakeById, type RakeSettings } from "@/lib/solveEngine/rake";
import { CHIP_EV, icmById, isChipEv, type IcmStructure } from "@/lib/solveEngine/icm";
import { replayActionPath } from "@/lib/solveEngine/replay";
import { computeAvailableActions } from "@/lib/solveEngine/actionSizing";
import { solveActiveSeat } from "@/lib/solveEngine/solve";
import { loadEquityMatrix } from "@/lib/equity/loadEquityMatrix";

const VALID_ACTIONS: ActionType[] = ["fold", "call", "raise", "allin"];
/** More actions than any hand has: eight seats, each acting a handful of times before the stacks are in. */
const MAX_ACTION_PATH = 64;

const requestSchema = z.object({
  effectiveStackBb: z.number().int().min(STACK_MIN_BB).max(STACK_MAX_BB),
  actionPath: z.array(z.object({ actor: z.enum(SEAT_ORDER), action: z.enum(VALID_ACTIONS) })).max(MAX_ACTION_PATH, `has more than ${MAX_ACTION_PATH} actions`),
  format: z.string().optional(),
  rake: z.string().optional(),
  noFlopNoDrop: z.boolean().optional(),
  icm: z.string().optional(),
});

/** The error code a malformed field answers with; anything else is about the action path. */
const FIELD_ERROR_CODES: Record<string, SolveErrorCode> = {
  effectiveStackBb: "INVALID_STACK",
  format: "INVALID_FORMAT",
  rake: "INVALID_RAKE",
  noFlopNoDrop: "INVALID_RAKE",
  icm: "INVALID_ICM",
};

function errorResponse(status: number, body: SolveErrorBody): Response {
  return Response.json(body, { status });
}

type ValidationResult =
  | { ok: true; value: Pick<SolveRequest, "effectiveStackBb" | "actionPath"> & { format: GameFormat; rake: RakeSettings; icm: IcmStructure } }
  | { ok: false; error: SolveErrorBody };

function validateRequest(body: unknown): ValidationResult {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue.path[0] ?? "");
    if (field === "effectiveStackBb") {
      return { ok: false, error: { error: `effectiveStackBb must be an integer between ${STACK_MIN_BB} and ${STACK_MAX_BB}`, code: "INVALID_STACK" } };
    }
    return { ok: false, error: { error: `${issue.path.join(".") || "body"}: ${issue.message}`, code: FIELD_ERROR_CODES[field] ?? "INVALID_ACTION_PATH" } };
  }
  const b = parsed.data;

  const format = b.format === undefined ? TOURNAMENT_8 : gameFormatById(b.format);
  if (!format) return { ok: false, error: { error: `Unknown format: ${b.format}`, code: "INVALID_FORMAT" } };

  const structure = b.rake === undefined ? NO_RAKE : rakeById(b.rake);
  if (!structure) return { ok: false, error: { error: `Unknown rake: ${b.rake}`, code: "INVALID_RAKE" } };
  const rake = { structure: format.allowsRake ? structure : NO_RAKE, noFlopNoDrop: b.noFlopNoDrop ?? true };

  const icm = b.icm === undefined ? CHIP_EV : icmById(b.icm);
  if (!icm) return { ok: false, error: { error: `Unknown icm: ${b.icm}`, code: "INVALID_ICM" } };

  return { ok: true, value: { effectiveStackBb: b.effectiveStackBb, actionPath: b.actionPath, format, rake, icm: format.allowsIcm ? icm : CHIP_EV } };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, { error: "Request body must be valid JSON", code: "INVALID_ACTION_PATH" });
  }

  const validated = validateRequest(body);
  if (!validated.ok) return errorResponse(400, validated.error);

  const { effectiveStackBb, actionPath, format, rake, icm } = validated.value;
  const replayResult = replayActionPath(actionPath, effectiveStackBb, format);

  if (replayResult.status === "invalid") {
    return errorResponse(400, { error: replayResult.reason, code: "INVALID_ACTION_PATH" });
  }
  if (replayResult.status === "resolved") {
    return errorResponse(400, {
      error: `Hand already resolved (${replayResult.reason})`,
      code: "HAND_RESOLVED",
      reason: replayResult.reason,
      actionPath: replayResult.canonicalActionPath,
      potBb: replayResult.potState.potBb,
      committed: replayResult.potState.committed,
    });
  }

  try {
    const matrix = loadEquityMatrix();
    const { activeSeat, potState, canonicalActionPath } = replayResult;
    const availableActions = computeAvailableActions(activeSeat, potState, effectiveStackBb);
    const { hands, source } = solveActiveSeat(matrix, activeSeat, potState, effectiveStackBb, rake, icm);

    const response: SolveResponse = {
      heroPosition: activeSeat,
      stackDepth: effectiveStackBb,
      nodeId: buildNodeId(canonicalActionPath),
      actionPath: canonicalActionPath,
      source,
      ...(isChipEv(icm) ? {} : { icm: icm.id }),
      generatedAt: new Date().toISOString(),
      version: packageJson.version,
      hands,
      potBb: potState.potBb,
      currentBetToCall: potState.currentBetToCall,
      availableActions,
    };
    return Response.json(response, { status: 200 });
  } catch (err) {
    // The cause stays in the logs: an engine error's text is no use to a visitor and says too much about the server.
    console.error("solve failed", err);
    return errorResponse(500, { error: "The solve failed on the server", code: "INTERNAL" });
  }
}
