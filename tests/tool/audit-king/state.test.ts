import { describe, expect, it } from "vitest";

import { createAuditKingState } from "../../../src/tool/app/audit-king/state";

describe("audit-king check item state", () => {
  const stateApi = createAuditKingState();

  it("keeps code, name and keyword as independent user-maintained fields", () => {
    const state = stateApi.createState();
    const item = stateApi.addCheckItem(state, {
      code: "1.1",
      name: "进入机长训练资格",
      keyword: "进入机长训练"
    });

    stateApi.updateCheckItem(state, item.id, { code: "1.2", name: "机长资格" });

    expect(state.checkItems[0]).toMatchObject({
      code: "1.2",
      name: "机长资格",
      keyword: "进入机长训练"
    });
  });

  it("does not infer missing code or name from keyword", () => {
    const state = stateApi.createState();
    stateApi.replaceCheckItems(state, [{ keyword: "定期复训" }]);

    expect(state.checkItems[0]).toMatchObject({ code: "", name: "", keyword: "定期复训" });
  });

  it("assigns stable candidate ids when imported evidence has none", () => {
    const state = stateApi.createState();
    stateApi.replaceCheckItems(state, [{
      keyword: "训练",
      manualEvidences: [{ documentName: "手册.docx", text: "训练要求" }]
    }]);

    expect(state.checkItems[0].manualEvidences[0].id).toMatch(/^manual-evidence-/);
  });

  it("stores checklist source on the same check item", () => {
    const state = stateApi.createState();
    const item = stateApi.addCheckItem(state, {
      code: "1.1",
      name: "资格",
      keyword: "机长训练",
      source: { blockId: "checklist-b1", start: 4, end: 8, text: "机长训练" }
    });

    stateApi.updateCheckItemSource(state, item.id, {
      blockId: "checklist-b2", start: 2, end: 6, text: "进入训练"
    });

    expect(state.checkItems[0].source).toMatchObject({ blockId: "checklist-b2", text: "进入训练" });
  });

  it("adopts a manual evidence by appending one audit evidence and keeps the candidate", () => {
    const state = stateApi.createState();
    const item = stateApi.addCheckItem(state, { code: "1.1", name: "资格", keyword: "训练" });
    const candidate = stateApi.addManualEvidence(state, item.id, {
      documentName: "运行手册.docx",
      blockIndex: 3,
      text: "进入训练前应满足资格要求。"
    });

    const adopted = stateApi.adoptManualEvidence(state, item.id, candidate.id!);
    const duplicate = stateApi.adoptManualEvidence(state, item.id, candidate.id!);

    expect(adopted.content).toBe("进入训练前应满足资格要求。");
    expect(duplicate.id).toBe(adopted.id);
    expect(state.checkItems[0].manualEvidences).toHaveLength(1);
    expect(state.checkItems[0].auditEvidences).toHaveLength(1);
    expect(state.checkItems[0].auditEvidences[0].sourceEvidenceId).toBe(candidate.id);
  });

  it("keeps manual audit evidence editable and removable", () => {
    const state = stateApi.createState();
    const item = stateApi.addCheckItem(state, { code: "", name: "人工条款", keyword: "" });
    const evidence = stateApi.addAuditEvidence(state, item.id, "依据 A", "人工");

    stateApi.updateAuditEvidence(state, item.id, evidence.id, { content: "依据 B", note: "复核" });
    expect(state.checkItems[0].auditEvidences[0]).toMatchObject({ content: "依据 B", note: "复核" });

    stateApi.removeAuditEvidence(state, item.id, evidence.id);
    expect(state.checkItems[0].auditEvidences).toEqual([]);
  });

  it("moves and removes complete check items so audit evidence cannot drift", () => {
    const state = stateApi.createState();
    const first = stateApi.addCheckItem(state, { code: "1.1", name: "A", keyword: "甲" });
    const second = stateApi.addCheckItem(state, { code: "1.2", name: "B", keyword: "乙" });
    stateApi.addAuditEvidence(state, first.id, "依据 A", "");

    stateApi.moveCheckItemToPosition(state, first.id, 2);
    expect(state.checkItems.map((item: any) => item.code)).toEqual(["1.2", "1.1"]);
    expect(state.checkItems[1].auditEvidences[0].content).toBe("依据 A");

    stateApi.removeCheckItem(state, second.id);
    expect(state.checkItems.map((item: any) => item.code)).toEqual(["1.1"]);
  });

  it("restores one complete project without changing check item identities", () => {
    const state = stateApi.createState();
    const manual = { id: "doc-1", name: "手册.pdf", blocks: [], sourceFile: new File(["manual"], "手册.pdf") };
    stateApi.restoreProject(state, {
      checklistFile: new File(["checklist"], "检查单.docx"),
      checklistBlocks: [],
      documents: [manual],
      checkItems: [{ id: "item-stable", code: "1.1", name: "资格", keyword: "训练", color: "#123456", enabled: true, manualEvidences: [], auditEvidences: [] }],
      locatorDocuments: [],
      pdfWorkspace: { slots: [{ id: "slot-1", sequence: "1.1", title: "资格", content: "", note: "", selected: true, pdfId: "", startPage: "", endPage: "" }], selectedSlotId: "slot-1", expandContextPages: false },
      view: { currentCheckItemId: "item-stable", documentFilterId: "doc-1" }
    });

    expect(state.checklistFile!.name).toBe("检查单.docx");
    expect(state.checkItems[0].id).toBe("item-stable");
    expect(state.currentCheckItemId).toBe("item-stable");
    expect(state.documentFilterId).toBe("doc-1");
    expect(state.pdfLocator.slots[0].id).toBe("slot-1");
  });

});
