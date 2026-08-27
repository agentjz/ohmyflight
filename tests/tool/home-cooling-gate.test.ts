import { describe, expect, it } from "vitest";

import { coolingGateLogic } from "../../src/tool/cooling-gate-logic";

describe("home cooling gate", () => {
  it("accepts unlock with surrounding whitespace and case differences", () => {
    expect(coolingGateLogic.matches("unlock")).toBe(true);
    expect(coolingGateLogic.matches("  UNLOCK  ")).toBe(true);
  });

  it("rejects other input", () => {
    expect(coolingGateLogic.matches("watchdog")).toBe(false);
    expect(coolingGateLogic.matches("")).toBe(false);
  });

  it("hides cooling tools until the gate is unlocked", () => {
    expect(coolingGateLogic.isToolVisible("cooling", false)).toBe(false);
    expect(coolingGateLogic.isToolVisible("cooling", true)).toBe(true);
    expect(coolingGateLogic.isToolVisible("beta", false)).toBe(true);
    expect(coolingGateLogic.isToolVisible(undefined, false)).toBe(true);
  });

  it("requires three rapid clicks on the same button", () => {
    const initial = { buttonKey: "", count: 0, firstClickedAt: Number.NEGATIVE_INFINITY };
    const first = coolingGateLogic.registerClick(initial, "category-all", 1000);
    const second = coolingGateLogic.registerClick(first.state, "category-all", 1200);
    const third = coolingGateLogic.registerClick(second.state, "category-all", 1400);

    expect(first.matched).toBe(false);
    expect(second.matched).toBe(false);
    expect(third.matched).toBe(true);
  });

  it("resets the sequence when the button or timing changes", () => {
    const initial = { buttonKey: "", count: 0, firstClickedAt: Number.NEGATIVE_INFINITY };
    const first = coolingGateLogic.registerClick(initial, "category-all", 1000);
    const differentButton = coolingGateLogic.registerClick(first.state, "category-heavy", 1100);
    const delayed = coolingGateLogic.registerClick(differentButton.state, "category-heavy", 1900);

    expect(differentButton.state.count).toBe(1);
    expect(delayed.state.count).toBe(1);
    expect(delayed.matched).toBe(false);
  });
});
