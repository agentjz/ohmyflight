import { describe, expect, it } from "vitest";

import { createAuditKingPdfLocatorModel } from "../../../src/tool/app/audit-king/pdf-locator-model";

describe("audit-king pdf locator model", () => {
    const model = createAuditKingPdfLocatorModel();

    it("normalizes text without losing business numbers and latin terms", () => {
        const normalized = model.normalizeLocatorText("7.5.4 飞行经历：具备 D 类机长资格，不少于 1000 小时；ICAO 四级。");

        expect(normalized).toContain("d类机长资格");
        expect(normalized).toContain("1000小时");
        expect(normalized).toContain("icao四级");
        expect(normalized).not.toContain("：");
        expect(normalized).not.toContain(" ");
    });

    it("splits evidence into stable meaningful segments", () => {
        const segments = model.buildEvidenceSegments([
            "7 机长转机型训练提纲",
            "7.5 进入条件",
            "7.5.1 语言能力水平",
            "有效的ICAO英语语言能力四级或以上签注。",
            "7.5.4 飞行经历",
            "具备D类机长资格，且D类机长飞行经历时间不少于1000小时，原则上具备航线飞行教员资格优先，总驾驶员飞行经历时间不少于4500小时。"
        ].join("\n"));

        expect(segments.some((item: any) => item.text.includes("icao英语语言能力四级"))).toBe(true);
        expect(segments.some((item: any) => item.text.includes("1000小时"))).toBe(true);
        expect(segments.every((item: any) => item.text.length >= 6)).toBe(true);
    });

    it("locates 1.1 in training outline pages 50-51 by concentrated ordered segments", () => {
        const evidence = [
            "7 机长转机型训练提纲",
            "7.5 进入条件",
            "7.5.1 语言能力水平",
            "有效的ICAO英语语言能力四级或以上签注。",
            "7.5.2 执照",
            "持有航线运输驾驶员执照签注有飞机型别等级、多发等级的驾驶员。",
            "7.5.3 体检合格证",
            "有效I类体检合格证，并且至少在完成训练前有效。",
            "7.5.4 飞行经历",
            "具备D类机长资格，且D类机长飞行经历时间不少于1000小时，原则上具备航线飞行教员资格优先，总驾驶员飞行经历时间不少于4500小时。"
        ].join("\n");
        const document = makeDocument("training", "飞行人员训练大纲.pdf", [
            { pageNumber: 49, text: "其他章节。训练资料。考试题。" },
            {
                pageNumber: 50,
                text: [
                    "中国南方货运航空 飞行人员训练大纲 CSG-FLT-01",
                    "7 机长转机型训练提纲",
                    "7.1 训练目的和适用范围 通过训练使受训驾驶员掌握飞机各系统知识。",
                    "7.2 训练设备、设施 使用符合 CCAR-121 第 121.407 条要求。",
                    "7.3 训练资料 公司《运行手册》 FCOM、QRH、AFM、FCTM MEL/CDL。",
                    "7.4 教学方法 理论训练：课堂、网络 CBT 或远程视频教学。",
                    "7.5 进入条件",
                    "7.5.1 语言能力水平 有效的ICAO英语语言能力四级或以上签注。",
                    "7.5.2 执照 持有航线运输驾驶员执照签注有飞机型别等级、多发等级的驾驶员。",
                    "7.5.3 体检合格证 有效I类体检合格证，并且至少在完成训练前有效。",
                    "2026/01/10 《飞行人员训练大纲》 50"
                ].join("\n")
            },
            {
                pageNumber: 51,
                text: [
                    "中国南方货运航空 飞行人员训练大纲 CSG-FLT-01",
                    "7.5.4 飞行经历",
                    "具备 D 类机长资格，且 D 类机长飞行经历时间不少于 1000 小时，原则上具备航线飞行教员资格优先，总驾驶员飞行经历时间不少于 4500 小时。",
                    "7.6 地面理论训练 课程安排。",
                    "2026/01/10 《飞行人员训练大纲》 51"
                ].join("\n")
            }
        ]);

        const result = model.locateEvidenceInDocuments({ sequence: "1.1", content: evidence }, [document]);

        expect(result.status).toBe("trusted");
        expect(result.pdfName).toBe("飞行人员训练大纲.pdf");
        expect(result.startPage).toBe(50);
        expect(result.endPage).toBe(51);
        expect(result.coverage).toBeGreaterThanOrEqual(0.8);
    });

    it("locates 1.4 in training outline pages 36-37 without hard-coded sequence rules", () => {
        const evidence = [
            "5 副驾驶转机型训练提纲",
            "5.5 进入条件",
            "5.5.1 语言能力水平",
            "有效的ICAO英语语言能力四级或以上签注。",
            "5.5.2 执照",
            "持有商用驾驶员执照并通过航线运输驾驶员执照理论考试。",
            "5.5.3 体检合格证",
            "有效I类体检合格证，并且至少在完成训练前有效。",
            "5.5.4 飞行经历",
            "满足进入副驾驶训练所需的飞行经历和公司运行经历要求。"
        ].join("\n");
        const document = makeDocument("training", "飞行人员训练大纲.pdf", [
            {
                pageNumber: 36,
                text: [
                    "5 副驾驶转机型训练提纲",
                    "5.1 训练目的和适用范围 通过训练掌握飞机系统知识。",
                    "5.2 训练设备、设施 使用经批准的模拟机。",
                    "5.3 训练资料 公司《运行手册》 FCOM QRH。",
                    "5.4 教学方法 理论训练和模拟机训练。",
                    "5.5 进入条件",
                    "5.5.1 语言能力水平 有效的ICAO英语语言能力四级或以上签注。",
                    "5.5.2 执照 持有商用驾驶员执照并通过航线运输驾驶员执照理论考试。",
                    "2026/01/10 《飞行人员训练大纲》 36"
                ].join("\n")
            },
            {
                pageNumber: 37,
                text: [
                    "5.5.3 体检合格证",
                    "有效I类体检合格证，并且至少在完成训练前有效。",
                    "5.5.4 飞行经历",
                    "满足进入副驾驶训练所需的飞行经历和公司运行经历要求。",
                    "5.6 地面理论训练"
                ].join("\n")
            }
        ]);

        const result = model.locateEvidenceInDocuments({ sequence: "1.4", content: evidence }, [document]);

        expect(result.status).toBe("trusted");
        expect(result.startPage).toBe(36);
        expect(result.endPage).toBe(37);
    });

    it("locates 1.6 in running manual page 357 as a single-page hit", () => {
        const evidence = [
            "6.3 签派放行要求",
            "合格证持有人应当向机长提供涉及运行的完整信息。",
            "这些信息包括该机场适用的运行资料、通信程序、导航设施、障碍物和最低安全高度。",
            "机长应当了解航路、终端区和机场运行所需资料。"
        ].join("\n");
        const document = makeDocument("running", "运行手册（南货航）.pdf", [
            { pageNumber: 356, text: "6.2 其他运行要求。" },
            {
                pageNumber: 357,
                text: [
                    "中国南方货运航空 运行手册",
                    "6.3 签派放行要求 CCAR121.189/195/467",
                    "合格证持有人应当向机长提供涉及运行的完整信息。",
                    "这些信息包括该机场适用的运行资料、通信程序、导航设施、障碍物和最低安全高度。",
                    "机长应当了解航路、终端区和机场运行所需资料。",
                    "2026/01/10 《运行手册》 357"
                ].join("\n")
            }
        ]);

        const result = model.locateEvidenceInDocuments({ sequence: "1.6", content: evidence }, [document]);

        expect(result.status).toBe("trusted");
        expect(result.pdfName).toBe("运行手册（南货航）.pdf");
        expect(result.startPage).toBe(357);
        expect(result.endPage).toBe(357);
    });

    it("does not trust a weak scattered hit", () => {
        const result = model.locateEvidenceInDocuments(
            { sequence: "x", content: "机长资格要求。\n航线飞行教员资格优先。\n总驾驶员飞行经历时间不少于4500小时。" },
            [makeDocument("training", "飞行人员训练大纲.pdf", [
                { pageNumber: 1, text: "机长资格要求。" },
                { pageNumber: 8, text: "航线飞行教员资格优先。" },
                { pageNumber: 19, text: "总驾驶员飞行经历时间不少于4500小时。" }
            ])]
        );

        expect(result.status).not.toBe("trusted");
    });

    it("builds editable PDF evidence slots from audit basket groups", () => {
        const slots = model.buildSlotsFromEvidenceGroups([
            {
                id: "group-1",
                title: "1.1 机长转机型",
                items: [
                    { content: "有效的ICAO英语语言能力四级或以上签注。", note: "训练大纲" }
                ]
            }
        ]);

        expect(slots).toHaveLength(1);
        expect(slots[0]).toMatchObject({
            sequence: "1.1",
            title: "1.1 机长转机型",
            content: "有效的ICAO英语语言能力四级或以上签注。",
            note: "训练大纲",
            selected: true,
            pdfId: "",
            startPage: "",
            endPage: ""
        });
    });

    it("expands auto-located slot pages by one page before and after the matched range", () => {
        const evidence = [
            "7.5.1 语言能力水平",
            "有效的ICAO英语语言能力四级或以上签注。",
            "7.5.2 执照",
            "持有航线运输驾驶员执照签注有飞机型别等级、多发等级的驾驶员。",
            "7.5.3 体检合格证",
            "有效I类体检合格证，并且至少在完成训练前有效。",
            "7.5.4 飞行经历",
            "具备D类机长资格，且D类机长飞行经历时间不少于1000小时。"
        ].join("\n");
        const document = {
            ...makeDocument("training", "飞行人员训练大纲.pdf", [
                { pageNumber: 49, text: "上一页背景。" },
                {
                    pageNumber: 50,
                    text: [
                        "7.5.1 语言能力水平 有效的ICAO英语语言能力四级或以上签注。",
                        "7.5.2 执照 持有航线运输驾驶员执照签注有飞机型别等级、多发等级的驾驶员。"
                    ].join("\n")
                },
                {
                    pageNumber: 51,
                    text: [
                        "7.5.3 体检合格证 有效I类体检合格证，并且至少在完成训练前有效。",
                        "7.5.4 飞行经历 具备D类机长资格，且D类机长飞行经历时间不少于1000小时。"
                    ].join("\n")
                },
                { pageNumber: 52, text: "后一页背景。" }
            ]),
            pageCount: 52
        };

        const slots = model.locateSlots([{
            id: "slot-1",
            sequence: "1.1",
            title: "1.1",
            content: evidence,
            note: "",
            selected: true,
            pdfId: "",
            startPage: "",
            endPage: ""
        }], [document]);

        expect(slots[0]!.result!.startPage).toBe(50);
        expect(slots[0]!.result!.endPage).toBe(51);
        expect(slots[0].startPage).toBe(49);
        expect(slots[0].endPage).toBe(52);
    });

    it("does not expand auto-located slot pages outside the PDF bounds", () => {
        const document = {
            ...makeDocument("manual", "运行手册.pdf", [
                {
                    pageNumber: 1,
                    text: "合格证持有人应当向机长提供涉及运行的完整信息。机长应当了解航路资料。"
                },
                { pageNumber: 2, text: "其他内容。" }
            ]),
            pageCount: 2
        };

        const slots = model.locateSlots([{
            id: "slot-1",
            sequence: "1.1",
            title: "1.1",
            content: "合格证持有人应当向机长提供涉及运行的完整信息。\n机长应当了解航路资料。",
            note: "",
            selected: true,
            pdfId: "",
            startPage: "",
            endPage: ""
        }], [document]);

        expect(slots[0]!.result!.startPage).toBe(1);
        expect(slots[0]!.result!.endPage).toBe(1);
        expect(slots[0].startPage).toBe(1);
        expect(slots[0].endPage).toBe(2);
    });

    it("keeps auto-located slot pages on the matched range when context expansion is disabled", () => {
        const document = {
            ...makeDocument("manual", "运行手册.pdf", [
                { pageNumber: 1, text: "前一页背景。" },
                { pageNumber: 2, text: "合格证持有人应当向机长提供涉及运行的完整信息。机长应当了解航路资料。" },
                { pageNumber: 3, text: "后一页背景。" }
            ]),
            pageCount: 3
        };

        const slots = model.locateSlots([{
            id: "slot-1",
            sequence: "1.1",
            title: "1.1",
            content: "合格证持有人应当向机长提供涉及运行的完整信息。\n机长应当了解航路资料。",
            note: "",
            selected: true,
            pdfId: "",
            startPage: "",
            endPage: ""
        }], [document], { expandContextPages: false });

        expect(slots[0]!.result!.startPage).toBe(2);
        expect(slots[0]!.result!.endPage).toBe(2);
        expect(slots[0].startPage).toBe(2);
        expect(slots[0].endPage).toBe(2);
    });

    it("builds empty slots from a sequence range without range names", () => {
        const slots = model.buildEmptySlotsFromRange("1.1-1.3");

        expect(slots.map((slot: any) => slot.sequence)).toEqual(["1.1", "1.2", "1.3"]);
        expect(slots.every((slot: any) => slot.title === slot.sequence)).toBe(true);
        expect(slots.every((slot: any) => slot.content === "")).toBe(true);
    });

    it("compares audit basket segments against selected PDF pages", () => {
        const document = makeDocument("training", "飞行人员训练大纲.pdf", [
            {
                pageNumber: 50,
                text: "有效的ICAO英语语言能力四级或以上签注。"
            }
        ]);
        const slot = {
            id: "slot-1",
            sequence: "1.1",
            title: "1.1",
            content: "有效的ICAO英语语言能力四级或以上签注。\n总驾驶员飞行经历时间不少于4500小时。",
            note: "",
            selected: true,
            pdfId: "training",
            startPage: 50,
            endPage: 50
        };

        const comparisons = model.buildSlotComparison(slot, [document]);

        expect(comparisons.some((item: any) => item.matched && item.text.includes("icao英语语言能力四级"))).toBe(true);
        expect(comparisons.some((item: any) => !item.matched && item.text.includes("4500小时"))).toBe(true);
    });

    it("builds export tasks and reports incomplete slots", () => {
        const document = { ...makeDocument("training", "飞行人员训练大纲.pdf", [{ pageNumber: 1, text: "正文" }]), pageCount: 2 };
        const tasks = model.buildExportTasks([
            {
                id: "slot-1",
                sequence: "1.1",
                title: "1.1 机长转机型",
                content: "正文",
                note: "",
                selected: true,
                pdfId: "training",
                startPage: 1,
                endPage: 2
            },
            {
                id: "slot-2",
                sequence: "1.2",
                title: "1.2",
                content: "正文",
                note: "",
                selected: true,
                pdfId: "",
                startPage: "",
                endPage: ""
            }
        ], [document], { onlySelected: true });

        expect(tasks[0]).toMatchObject({
            sequence: "1.1",
            pdfName: "飞行人员训练大纲.pdf",
            startPage: 1,
            endPage: 2
        });
        expect(tasks[0].filename).toContain("1.1");
        expect(tasks[1].skippedReason).toBe("未选择 PDF。");
    });

    it("exports and restores PDF workspace slots by PDF file name", () => {
        const oldDocument = { ...makeDocument("old-training-id", "飞行人员训练大纲.pdf", [{ pageNumber: 1, text: "正文" }]), pageCount: 2 };
        const json = model.serializeWorkspace([{
            id: "slot-1",
            sequence: "1.1",
            title: "1.1 机长转机型",
            content: "审计篮子原文",
            note: "备注",
            selected: true,
            pdfId: "old-training-id",
            startPage: 1,
            endPage: 2,
            result: {
                sequence: "1.1",
                title: "1.1 机长转机型",
                content: "审计篮子原文",
                status: "trusted",
                pdfId: "old-training-id",
                pdfName: "飞行人员训练大纲.pdf",
                startPage: 1,
                endPage: 1,
                coverage: 1,
                orderRatio: 1,
                score: 1,
                matchedSegments: 3,
                totalSegments: 3,
                reason: "片段集中命中连续页面，顺序一致。",
                snippets: ["正文"]
            }
        }], [oldDocument], "slot-1", false);
        const newDocument = { ...makeDocument("new-training-id", "飞行人员训练大纲.pdf", [{ pageNumber: 1, text: "正文" }]), pageCount: 2 };

        const restored = model.parseWorkspace(json, [newDocument]);

        expect(restored.selectedSlotId).toBe("slot-1");
        expect(restored.expandContextPages).toBe(false);
        expect(restored.slots[0]).toMatchObject({
            id: "slot-1",
            sequence: "1.1",
            title: "1.1 机长转机型",
            content: "审计篮子原文",
            pdfId: "new-training-id",
            pdfName: "飞行人员训练大纲.pdf",
            startPage: 1,
            endPage: 2
        });
        expect(restored.slots[0]!.result!.pdfId).toBe("new-training-id");
    });
});

function makeDocument(id: string, name: string, pages: Array<{ pageNumber: number; text: string }>) {
    return {
        id,
        name,
        pages: pages.map((page) => ({
            pdfId: id,
            pdfName: name,
            pageNumber: page.pageNumber,
            text: page.text
        }))
    };
}
