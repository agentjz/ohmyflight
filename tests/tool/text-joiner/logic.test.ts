import { describe, expect, it } from "vitest";

import * as logic from "../../../src/tool/app/text-joiner/logic";

describe("text-joiner logic", () => {
  it("joins multiline names without spacing by default", () => {
    const result = logic.join("张鑫豪\n付杰明\n蓝锦坚\n周桐\n朱灿仪");

    expect(result.items).toEqual(["张鑫豪", "付杰明", "蓝锦坚", "周桐", "朱灿仪"]);
    expect(result.text).toBe("张鑫豪付杰明蓝锦坚周桐朱灿仪");
  });

  it("removes common whitespace and punctuation before using a custom separator", () => {
    const result = logic.join("张鑫豪，付杰明、蓝锦坚；周桐 / 朱灿仪。", "、");

    expect(result.items).toEqual(["张鑫豪", "付杰明", "蓝锦坚", "周桐", "朱灿仪"]);
    expect(result.text).toBe("张鑫豪、付杰明、蓝锦坚、周桐、朱灿仪");
  });

  it("ignores empty input and keeps the requested separator literal", () => {
    expect(logic.join(" \n，；", " | ")).toEqual({ items: [], text: "" });
    expect(logic.join("甲\n乙", " | ").text).toBe("甲 | 乙");
  });
});
