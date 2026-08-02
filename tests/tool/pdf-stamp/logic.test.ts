import { describe, expect, it } from "vitest";

import * as logic from "../../../src/tool/app/pdf-stamp/logic";
import type { PdfStampRule } from "../../../src/tool/app/pdf-stamp/models";

describe("pdf stamp logic", () => {
  it("parses page ranges with de-duplication and bounds", () => {
    expect(logic.parsePageRange("1, 3-5, 5, 0, 99, a, 8-6", 8)).toEqual([1, 3, 4, 5, 6, 7, 8]);
  });

  it("matches pages by rule mode", () => {
    expect(logic.ruleMatchesPage({ mode: "all", rangeStr: "" }, 2, 5)).toBe(true);
    expect(logic.ruleMatchesPage({ mode: "odd", rangeStr: "" }, 3, 5)).toBe(true);
    expect(logic.ruleMatchesPage({ mode: "even", rangeStr: "" }, 3, 5)).toBe(false);
    expect(logic.ruleMatchesPage({ mode: "range", rangeStr: "2,4-5" }, 4, 5)).toBe(true);
    expect(logic.ruleMatchesPage({ mode: "range", rangeStr: "2,4-5" }, 6, 5)).toBe(false);
  });

  it("creates default rule size from image aspect and converts draw coordinates", () => {
    const rule = logic.createRule(7, 2, { xMm: 10, yMm: 20, wMm: 30, hMm: 15, opacity: 0.5 });
    const options = logic.buildStampDrawOptions(rule, 200);

    expect(rule.id).toBe(7);
    expect(rule.hMm).toBe(15);
    expect(options.x).toBeCloseTo(10 * logic.MM2PT);
    expect(options.width).toBeCloseTo(30 * logic.MM2PT);
    expect(options.height).toBeCloseTo(15 * logic.MM2PT);
    expect(options.y).toBeCloseTo(200 - 20 * logic.MM2PT - 15 * logic.MM2PT);
    expect(options.opacity).toBe(0.5);
  });

  it("updates rule fields and keeps size ratio when ratio lock is enabled", () => {
    const base = logic.createRule(1, 2, { wMm: 40, hMm: 20, lockRatio: true });

    expect(logic.updateRuleField(base, "wMm", "60", 2)).toMatchObject({
      wMm: 60,
      hMm: 30
    });
    expect(logic.updateRuleField(base, "hMm", "10", 2)).toMatchObject({
      wMm: 20,
      hMm: 10
    });
    expect(logic.updateRuleField(base, "mode", "range", 2).mode).toBe("range");
    expect(logic.updateRuleField(base, "rangeStr", "1,3-5", 2).rangeStr).toBe("1,3-5");
  });

  it("converts rule position and size to overlay pixels", () => {
    const rule = logic.createRule(1, 2, { xMm: 10, yMm: 20, wMm: 30, hMm: 15, opacity: 0.4 });
    const style = logic.buildOverlayStyle(rule, 1.5);

    expect(style.leftPx).toBeCloseTo(10 * logic.MM2PT * 1.5);
    expect(style.topPx).toBeCloseTo(20 * logic.MM2PT * 1.5);
    expect(style.widthPx).toBeCloseTo(30 * logic.MM2PT * 1.5);
    expect(style.heightPx).toBeCloseTo(15 * logic.MM2PT * 1.5);
    expect(style.opacity).toBe("0.4");
  });

  it("moves overlay within canvas bounds and converts pixels back to millimeters", () => {
    const rule = logic.createRule(1, 1, { xMm: 0, yMm: 0, wMm: 10, hMm: 10 });
    const moved = logic.applyOverlayMove(rule, {
      dxPx: 40,
      dyPx: 20,
      startLeftPx: 10,
      startTopPx: 10,
      widthPx: 30,
      heightPx: 30,
      canvasWidthPx: 60,
      canvasHeightPx: 50,
      renderScale: 1
    });

    expect(moved.xMm).toBeCloseTo(30 / logic.MM2PT);
    expect(moved.yMm).toBeCloseTo(20 / logic.MM2PT);
  });

  it("resizes overlay from handles with optional ratio lock", () => {
    const locked = logic.createRule(1, 2, { lockRatio: true });
    const resized = logic.applyOverlayResize(locked, {
      direction: "br",
      dxPx: 20,
      dyPx: 100,
      startLeftPx: 10,
      startTopPx: 10,
      startWidthPx: 40,
      startHeightPx: 20,
      renderScale: 1,
      imgAspect: 2
    });
    expect(resized.wMm).toBeCloseTo(60 / logic.MM2PT);
    expect(resized.hMm).toBeCloseTo(30 / logic.MM2PT);

    const unlocked = logic.createRule(2, 2, { lockRatio: false });
    const topLeft = logic.applyOverlayResize(unlocked, {
      direction: "tl",
      dxPx: 10,
      dyPx: 5,
      startLeftPx: 20,
      startTopPx: 30,
      startWidthPx: 50,
      startHeightPx: 40,
      renderScale: 1,
      imgAspect: 2
    });
    expect(topLeft.xMm).toBeCloseTo(30 / logic.MM2PT);
    expect(topLeft.yMm).toBeCloseTo(35 / logic.MM2PT);
    expect(topLeft.wMm).toBeCloseTo(40 / logic.MM2PT);
    expect(topLeft.hMm).toBeCloseTo(35 / logic.MM2PT);
  });

  it("builds export plan with only pages that have matching rules", () => {
    const rules = [
      logic.createRule(1, 1, { mode: "odd", rangeStr: "" }),
      logic.createRule(2, 1, { mode: "range", rangeStr: "2,4" })
    ];

    expect(logic.buildExportPlan(rules, 4).map(page => ({
      pageNum: page.pageNum,
      ruleIds: page.rules.map((rule: PdfStampRule) => rule.id)
    }))).toEqual([
      { pageNum: 1, ruleIds: [1] },
      { pageNum: 2, ruleIds: [2] },
      { pageNum: 3, ruleIds: [1] },
      { pageNum: 4, ruleIds: [2] }
    ]);
  });
});
