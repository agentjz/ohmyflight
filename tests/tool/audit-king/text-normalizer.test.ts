import { describe, expect, it } from "vitest";

import { AuditKingTextNormalizer as normalizer } from "../../../src/tool/app/audit-king/text-normalizer";

describe("audit-king text normalizer", () => {
  it("normalizes text for loose search without changing exact text", () => {
    const raw = "121.417（a）\n航线 运输驾驶员　执照，进入 条件";

    expect(normalizer.normalizeLoose(raw)).toBe("121417a航线运输驾驶员执照进入条件");
    expect(normalizer.normalizeExact(raw)).toBe(raw);
  });

  it("builds a loose index that maps normalized offsets back to original offsets", () => {
    const index = normalizer.buildLooseIndex("A B\nＣ（D）");

    expect(index.normalized).toBe("abcd");
    expect(index.offsetMap.map((item: any) => item.originalStart)).toEqual([0, 2, 4, 6]);
  });

  it("ignores Unicode punctuation while preserving original match coordinates", () => {
    const index = normalizer.buildLooseIndex("导航设施，包括机场目视助航设备。");
    const query = normalizer.normalizeLoose("导航设施包括机场目视助航设备");
    const start = index.normalized.indexOf(query);
    const end = start + query.length - 1;

    expect(start).toBe(0);
    expect(index.offsetMap[start].originalStart).toBe(0);
    expect(index.offsetMap[end].originalEnd).toBe("导航设施，包括机场目视助航设备".length);
  });
});
