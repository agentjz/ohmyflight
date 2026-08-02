import { describe, expect, it } from "vitest";

import { AuditKingFolderScriptGenerator as generator } from "../../../src/tool/app/audit-king/folder-script-generator";

describe("audit-king folder script generator", () => {
    it("builds one folder name for each number in a full X.X-X.X range", () => {
        expect(generator.buildFolderRanges({
            rangeText: "1.1-1.4"
        })).toEqual(["1.1", "1.2", "1.3", "1.4"]);
    });

    it("expands every number in the configured range without grouping", () => {
        expect(generator.buildFolderRanges({
            rangeText: "1.10-1.12"
        })).toEqual(["1.10", "1.11", "1.12"]);
    });

    it("preserves padding only when the configured range uses padding", () => {
        expect(generator.buildFolderRanges({
            rangeText: "1.01-1.03"
        })).toEqual(["1.01", "1.02", "1.03"]);
    });

    it("rejects invalid folder range settings", () => {
        expect(() => generator.buildFolderRanges({
            rangeText: "1.5-1.1"
        })).toThrow("结束编号不能小于起始编号");

        expect(() => generator.buildFolderRanges({
            rangeText: "1.1-2.2"
        })).toThrow("当前只支持同一一级编号");

        expect(() => generator.buildFolderRanges({
            rangeText: "1.1"
        })).toThrow("范围格式应为");
    });

    it("builds a standalone Python script that only creates configured folders", () => {
        const python = generator.buildFolderCreatorPython({
            rangeText: "1.1-1.2"
        });

        expect(python).toContain("from pathlib import Path");
        expect(python).toContain("\"1.1\"");
        expect(python).toContain("\"1.2\"");
        expect(python).not.toContain("\"1.1-1.1\"");
        expect(python).toContain("mkdir(exist_ok=True)");
        expect(python).not.toContain("shutil");
        expect(python).not.toContain("rmdir");
    });
});
