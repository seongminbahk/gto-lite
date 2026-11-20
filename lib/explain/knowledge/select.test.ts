import { describe, expect, it } from "vitest";
import { SAMPLE_SUMMARY } from "../explainTestUtils";
import { FEATURE_TAGS, type FeatureTag } from "./features";
import { NOTES } from "./notes";
import { NOTE_LIMIT, notesForHand, selectNotes } from "./select";

describe("selectNotes", () => {
  it("takes at most the limit, only notes that match, and the same ones every time", () => {
    const all = new Set<FeatureTag>(FEATURE_TAGS);
    expect(selectNotes(all)).toHaveLength(NOTE_LIMIT);
    expect(selectNotes(new Set())).toEqual([]);
    expect(selectNotes(new Set(["paired-board" as never, "board-paired"])).map((n) => n.id)).toEqual(["paired-board"]);
    expect(selectNotes(all)).toEqual(selectNotes(all));
  });

  it("puts ICM and push/fold first whatever else matches", () => {
    const ids = selectNotes(new Set<FeatureTag>(["range-advantage", "nut-advantage", "overbet", "big-bet", "check-raise", "icm", "push-fold"])).map((n) => n.id);
    expect(ids.slice(0, 2).sort()).toEqual(["icm", "push-fold"]);
  });

  it("prefers notes matching more of the hand", () => {
    expect(selectNotes(new Set<FeatureTag>(["overbet", "nut-advantage"]), 1)[0].id).toBe("nut-advantage");
  });

  it("gives the hand's notes in the reader's language", () => {
    const en = notesForHand(SAMPLE_SUMMARY, "en");
    const ko = notesForHand(SAMPLE_SUMMARY, "ko");
    expect(en.map((n) => n.topic)).toEqual(ko.map((n) => n.topic));
    expect(en.map((n) => n.topic)).toContain("range-advantage");
    expect(ko[0].text).toMatch(/[가-힣]/);
  });
});

describe("NOTES", () => {
  it("each has a unique id, known tags, and both languages within length", () => {
    expect(new Set(NOTES.map((n) => n.id)).size).toBe(NOTES.length);
    for (const note of NOTES) {
      expect(note.tags.length).toBeGreaterThan(0);
      for (const tag of note.tags) expect(FEATURE_TAGS).toContain(tag);
      expect(note.en.split(/\s+/).length).toBeLessThanOrEqual(80);
      expect(note.ko.length).toBeLessThanOrEqual(300);
      expect(note.ko).toMatch(/[가-힣]/);
    }
  });

  it("every feature is covered by some note", () => {
    const covered = new Set(NOTES.flatMap((n) => n.tags));
    expect(FEATURE_TAGS.filter((t) => !covered.has(t))).toEqual([]);
  });
});
