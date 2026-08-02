import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { createProjectPackage } from "../../../src/tool/app/proof-king/project-package";
import { createProjectArchive } from "../../../src/tool/project-archive";

const projectPackage: any = createProjectPackage(createProjectArchive(JSZip));

describe("校对之王项目包", () => {
    it("携带两本原手册、比较快照、人工决定、视图和Excel记录", async () => {
        const bytes = await projectPackage.build({
            myFile: new File(["my-manual"], "my.pdf", { type: "application/pdf" }),
            referenceFile: new File(["reference-manual"], "reference.pdf", { type: "application/pdf" }),
            myRange: { startPage: 2, endPage: 8 },
            referenceRange: { startPage: 3, endPage: 9 },
            comparison: comparison(),
            decisions: { "revision-1": "included" },
            view: { filter: "reference-added", query: "训练", selectedId: "revision-1", expandedChapterKey: "chapter:5" },
            workbook: new Uint8Array([80, 75, 3, 4])
        });
        const restored = await projectPackage.read(bytes);

        expect(await restored.myFile.text()).toBe("my-manual");
        expect(await restored.referenceFile.text()).toBe("reference-manual");
        expect(restored.state).toMatchObject({
            manuals: { my: { range: { startPage: 2, endPage: 8 } } },
            decisions: { "revision-1": "included" },
            comparison: { events: [{ id: "revision-1" }] }
        });
        expect(Array.from(restored.workbook)).toEqual([80, 75, 3, 4]);
    });

    it("拒绝修订事件编号重复的损坏状态", () => {
        const state = {
            version: 1,
            manuals: { my: { path: "my.pdf" }, reference: { path: "reference.pdf" } },
            comparison: { events: [{ id: "revision-1" }, { id: "revision-1" }], summary: {} },
            decisions: {},
            view: {}
        };

        expect(() => projectPackage.validateState(state)).toThrow("修订事件编号");
    });
});

function comparison() {
    return {
        mySlices: [],
        referenceSlices: [],
        events: [{ id: "revision-1" }],
        summary: { myManualName: "my.pdf", referenceManualName: "reference.pdf" }
    };
}
