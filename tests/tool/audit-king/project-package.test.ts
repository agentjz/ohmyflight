import { webcrypto } from "node:crypto";

import JSZip from "jszip";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createProjectArchive } from "../../../src/tool/project-archive";
import { createAuditKingProjectPackage } from "../../../src/tool/app/audit-king/project-package";

describe("审计之王项目包", () => {
    let projectPackage: any;

    beforeAll(() => {
        vi.stubGlobal("crypto", webcrypto);
        projectPackage = createAuditKingProjectPackage(createProjectArchive(JSZip));
    });

    it("携带检查单、普通手册、PDF工作区文件、检查项和槽位", async () => {
        const bytes = await projectPackage.build({
            checklistFile: new File(["checklist"], "checklist.docx"),
            manualFiles: [new File(["manual"], "manual.pdf", { type: "application/pdf" })],
            locatorFiles: [new File(["locator"], "locator.pdf", { type: "application/pdf" })],
            state: {
                checkItems: [{ id: "item-1", code: "1.1", manualEvidences: [], auditEvidences: [] }],
                pdfWorkspace: { slots: [{ id: "slot-1", selected: true }], selectedSlotId: "slot-1", expandContextPages: true },
                view: { currentCheckItemId: "item-1", documentFilterId: "all" }
            },
            workbook: new Uint8Array([80, 75, 3, 4])
        });
        const restored = await projectPackage.read(bytes);

        expect(await restored.checklistFile.text()).toBe("checklist");
        expect(await restored.manualFiles[0].text()).toBe("manual");
        expect(await restored.locatorFiles[0].text()).toBe("locator");
        expect(restored.state).toMatchObject({
            checkItems: [{ id: "item-1" }],
            pdfWorkspace: { slots: [{ id: "slot-1", selected: true }] }
        });
    });

    it("拒绝检查项或PDF槽位编号重复的损坏状态", () => {
        const base = {
            version: 1,
            sources: { checklist: { path: "checklist.docx" }, manuals: [], locatorFiles: [] },
            checkItems: [{ id: "item-1" }, { id: "item-1" }],
            pdfWorkspace: { slots: [{ id: "slot-1" }], selectedSlotId: "slot-1", expandContextPages: true },
            view: { currentCheckItemId: "item-1", documentFilterId: "all" }
        };

        expect(() => projectPackage.validateState(base)).toThrow("检查项编号");
        expect(() => projectPackage.validateState({
            ...base,
            checkItems: [{ id: "item-1" }],
            pdfWorkspace: { ...base.pdfWorkspace, slots: [{ id: "slot-1" }, { id: "slot-1" }] }
        })).toThrow("PDF 槽位编号");
    });
});
