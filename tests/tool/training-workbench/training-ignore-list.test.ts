import { describe, expect, it } from "vitest";

import { TrainingToolTrainingIgnoreList as TrainingIgnoreList } from "../../../src/tool/app/training-workbench/scripts/training-ignore-list";

describe("training ignore list", () => {
  it.each(["程春林", "宋云龙", "邢晓楠"])("ignores every monitored qualification for non-flying person %s", (name) => {
    expect(TrainingIgnoreList.shouldIgnore({ name }, "危险品")).toBe(true);
    expect(TrainingIgnoreList.shouldIgnore({ name }, "飞行作风")).toBe(true);
    expect(TrainingIgnoreList.shouldIgnore({ name }, "汉语能力")).toBe(true);
    expect(TrainingIgnoreList.getIgnoreReason({ name }, "汉语能力")).toContain("不飞人员");
  });

  it("keeps project-specific ignore entries limited to their configured qualifications", () => {
    expect(TrainingIgnoreList.shouldIgnore({ name: "沈欣" }, "航空安保")).toBe(true);
    expect(TrainingIgnoreList.shouldIgnore({ name: "沈欣" }, "危险品")).toBe(false);
  });
});
