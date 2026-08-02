import { describe, expect, it } from "vitest";

import { formatRange, parseRange } from "../../../src/tool/app/pdf-tool/shared";

describe("pdf tool page ranges", () => {
  it("keeps the established page parsing and formatting behavior", () => {
    expect(parseRange("1,3,5-7,7,0,99", 8)).toEqual([1, 3, 5, 6, 7]);
    expect(formatRange(new Set([1, 2, 3, 5, 7, 8]))).toBe("1-3,5,7-8");
  });
});
