import { describe, expect, it } from "vitest";

import { homePatternLogic } from "../../src/tool/home-pattern-gate-logic";

describe("home pattern gate", () => {
  it("accepts the bottom horizontal line in either direction", () => {
    expect(homePatternLogic.matches([7, 8, 9])).toBe(true);
    expect(homePatternLogic.matches([9, 8, 7])).toBe(true);
    expect(homePatternLogic.matches([1, 2, 3])).toBe(false);
    expect(homePatternLogic.matches([7, 8])).toBe(false);
  });

  it("fills the middle dot when a swipe crosses it", () => {
    expect(homePatternLogic.appendNode([7], 9)).toEqual([7, 8, 9]);
    expect(homePatternLogic.appendNode([9], 7)).toEqual([9, 8, 7]);
  });
});
