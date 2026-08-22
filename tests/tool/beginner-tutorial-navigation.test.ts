import { describe, expect, it } from "vitest";

import {
  createTutorialNavigationTransition,
  encodeTutorialHash,
  readTutorialOrigin,
  resolveTutorialHash
} from "../../src/tool/app/beginner-tutorial/navigation";
import type { BeginnerTutorialData } from "../../src/tool/app/beginner-tutorial/types";

const data: BeginnerTutorialData = {
  schemaVersion: 1,
  title: "Test",
  description: "Test",
  sourceScope: [],
  modules: [
    { id: "captain-levels", title: "机长技术等级", kind: "levels", summary: "Test" },
    { id: "recovery", title: "重新获得资格训练", kind: "recovery", summary: "Test" }
  ]
};

describe("菜鸟教程超文本导航", () => {
  it("解析稳定模块与记录hash并对无效目标回到首模块", () => {
    const hash = encodeTutorialHash("recovery", "recovery-proficiency-failure-captain");

    expect(resolveTutorialHash(data, hash)).toEqual({
      moduleId: "recovery",
      recordId: "recovery-proficiency-failure-captain"
    });
    expect(resolveTutorialHash(data, "#missing/record")).toEqual({ moduleId: "captain-levels" });
  });

  it("为来源记录和目标详情建立可后退的两个历史状态", () => {
    const origin = { moduleId: "captain-levels", recordId: "captain-b", title: "B类机长" };
    const transition = createTutorialNavigationTransition(
      "recovery",
      "recovery-proficiency-failure-captain",
      origin
    );

    expect(transition.source).toEqual({
      state: { moduleId: "captain-levels", recordId: "captain-b" },
      hash: encodeTutorialHash("captain-levels", "captain-b")
    });
    expect(transition.target.state).toEqual({
      moduleId: "recovery",
      recordId: "recovery-proficiency-failure-captain",
      origin
    });
    expect(readTutorialOrigin(transition.target.state)).toEqual(origin);
    expect(readTutorialOrigin({ moduleId: "recovery" })).toBeUndefined();
  });
});
