import type { ExplainLanguage } from "../prompt";
import type { HandSummary } from "../summarySchema";
import { extractFeatures, type FeatureTag } from "./features";
import { NOTES, type KnowledgeNote } from "./notes";

/** Enough to cover a hand's main themes without burying its numbers. */
export const NOTE_LIMIT = 5;

/**
 * The notes a hand's features call for: essential ones first (ICM,
 * push/fold), then by how many of their tags match, then by priority. The
 * same hand always gets the same notes, in the same order.
 */
export function selectNotes(features: ReadonlySet<FeatureTag>, limit = NOTE_LIMIT): KnowledgeNote[] {
  return NOTES.map((note, index) => ({ note, index, matches: note.tags.filter((tag) => features.has(tag)).length }))
    .filter((c) => c.matches > 0)
    .sort(
      (a, b) =>
        Number(!!b.note.essential) - Number(!!a.note.essential) ||
        b.matches - a.matches ||
        b.note.priority - a.note.priority ||
        a.index - b.index,
    )
    .slice(0, limit)
    .map((c) => c.note);
}

/** The notes for one hand, in the reader's language. */
export function notesForHand(summary: HandSummary, language: ExplainLanguage): { topic: string; text: string }[] {
  return selectNotes(extractFeatures(summary)).map((note) => ({ topic: note.id, text: note[language] }));
}
