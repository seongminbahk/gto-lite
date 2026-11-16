import { describe, expect, it } from "vitest";
import { rangeEditsFromLine, rangeEditsToLine, sameRange, withRangeEdits } from "./rangeEdits";

const CHART = [{ hand: "AA", fold: 0, call: 0, raise: 1 }];
const INPUTS = { heroHands: CHART, heroActionKey: "raise" as const, villainHands: CHART, villainActionKey: "call" as const, startPot: 5 };

describe("rangeEdits", () => {
  it("reads a link's ranges, skipping one that doesn't read, and writes them back", () => {
    const edits = rangeEditsFromLine({ board: [], streets: [], ranges: { P1: "QQ+", P2: "AhKh" } });
    expect([...edits.P1!.keys()].sort()).toEqual(["AA", "KK", "QQ"]);
    expect(edits.P2).toBeUndefined();
    expect(rangeEditsToLine(edits)).toEqual({ ranges: { P1: "QQ+" } });
    expect(rangeEditsToLine({})).toEqual({});
    expect(rangeEditsFromLine(undefined)).toEqual({});
  });

  it("puts an edited range in the solve's inputs as calls and leaves the rest", () => {
    const solved = withRangeEdits(INPUTS, { P2: new Map([["KK", 0.5]]) });
    expect(solved.heroHands).toBe(CHART);
    expect(solved.heroActionKey).toBe("raise");
    expect(solved.villainActionKey).toBe("call");
    expect(solved.villainHands.find((h) => h.hand === "KK")).toMatchObject({ call: 0.5, fold: 0.5 });
    expect(solved.startPot).toBe(5);
    expect(withRangeEdits(INPUTS, {})).toEqual(INPUTS);
  });

  it("sees ranges as the same to two decimals", () => {
    expect(sameRange(new Map([["AA", 0.751]]), new Map([["AA", 0.75]]))).toBe(true);
    expect(sameRange(new Map([["AA", 0.75]]), new Map([["AA", 0.75], ["KK", 0.1]]))).toBe(false);
  });
});
