import type {
    ManualComparison,
    RevisionDecision,
    RevisionDecisionMap,
    RevisionDecisionSummary,
    RevisionEvent,
    RevisionReportGroup
} from "./models";
import { ManualProofNavigation as Navigation } from "./navigation";
import { ManualProofReportModel as ReportModel } from "./report-model";

export function createExcelReport(xlsx: typeof import("xlsx-js-style")) {

    function buildWorkbook(
        comparison: ManualComparison,
        events: RevisionEvent[] = comparison.events,
        decisions: RevisionDecisionMap = {}
    ): import("xlsx-js-style").WorkBook {
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, summarySheet(comparison, events, decisions), "总览");
        xlsx.utils.book_append_sheet(workbook, eventsSheet(events, decisions), "修订事件");
        xlsx.utils.book_append_sheet(workbook, eventsSheet(events.filter((event) => event.kind === "reference-added"), decisions), "参考新增");
        xlsx.utils.book_append_sheet(workbook, eventsSheet(events.filter((event) => event.kind === "reference-removed"), decisions), "参考删除");
        xlsx.utils.book_append_sheet(workbook, eventsSheet(events.filter((event) => event.kind === "modified"), decisions), "内容修改");
        xlsx.utils.book_append_sheet(workbook, eventsSheet(events.filter((event) => event.kind === "review"), decisions), "待确认");
        return workbook;
    }

    function summarySheet(comparison: ManualComparison, events: RevisionEvent[], decisions: RevisionDecisionMap): import("xlsx-js-style").WorkSheet {
        const summary = comparison.summary;
        const decisionSummary = comparison.events.reduce((result, event) => {
            result[decisionFor(decisions, event.id)] += 1;
            return result;
        }, { pending: 0, included: 0, excluded: 0 } as RevisionDecisionSummary);
        const sheet = xlsx.utils.aoa_to_sheet([
            ["项目", "值"],
            ["我的手册", summary.myManualName],
            ["参考手册", summary.referenceManualName],
            ["我的手册句级单元", summary.mySliceCount],
            ["参考手册句级单元", summary.referenceSliceCount],
            ["唯一原文锚点", summary.exactAnchorCount],
            ["顺序一致单元", summary.sameSliceCount],
            ["参考新增事件", summary.referenceAddedCount],
            ["参考删除事件", summary.referenceRemovedCount],
            ["内容修改事件", summary.modifiedCount],
            ["待确认事件", summary.reviewCount],
            ["本次导出事件", events.length],
            ["待处理", decisionSummary.pending],
            ["纳入报告", decisionSummary.included],
            ["不纳入", decisionSummary.excluded]
        ]);
        sheet["!cols"] = [{ wch: 24 }, { wch: 80 }];
        return sheet;
    }

    function eventsSheet(events: RevisionEvent[], decisions: RevisionDecisionMap): import("xlsx-js-style").WorkSheet {
        const rows: Array<Array<string | number>> = [[
            "序号", "人工决定", "类别", "章节", "小节编号", "小节标题", "组内序号",
            "我的手册位置", "我的手册完整原文", "参考手册位置", "参考手册完整原文",
            "对应度", "我的手册独有数字/英文", "参考手册独有数字/英文", "判断依据"
        ]];
        let eventIndex = 0;
        const groups = ReportModel.buildGroups(events) as RevisionReportGroup[];
        groups.forEach((group) => group.rows.forEach((_row, groupIndex) => {
            const event = events[eventIndex];
            eventIndex += 1;
            rows.push([
                eventIndex,
                decisionLabel(decisionFor(decisions, event.id)),
                Navigation.label(event.kind),
                group.chapter,
                group.number,
                group.title,
                groupIndex + 1,
                event.myLocation,
                event.myText,
                event.referenceLocation,
                event.referenceText,
                formatPercent(event.similarity),
                event.myTokensOnly.join("、"),
                event.referenceTokensOnly.join("、"),
                event.reason
            ]);
        }));
        const sheet = xlsx.utils.aoa_to_sheet(rows);
        sheet["!cols"] = [
            { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 34 }, { wch: 10 },
            { wch: 24 }, { wch: 80 }, { wch: 24 }, { wch: 80 }, { wch: 12 }, { wch: 28 }, { wch: 28 }, { wch: 44 }
        ];
        return sheet;
    }

    function buildWorkbookBytes(comparison: ManualComparison, events: RevisionEvent[], decisions: RevisionDecisionMap): Uint8Array {
        const output = xlsx.write(buildWorkbook(comparison, events, decisions), { bookType: "xlsx", type: "array" });
        return new Uint8Array(output);
    }

    function exportWorkbook(comparison: ManualComparison, events = comparison.events, decisions: RevisionDecisionMap = {}, scope = "全部"): void {
        xlsx.writeFile(buildWorkbook(comparison, events, decisions), `校对之王修订事件_${scope}_${dateStamp(new Date())}.xlsx`);
    }

    function formatPercent(value: number): string {
        return `${Math.round((Number(value) || 0) * 1000) / 10}%`;
    }

    function decisionFor(decisions: RevisionDecisionMap, eventId: string): RevisionDecision {
        const decision = decisions?.[eventId];
        return decision === "included" || decision === "excluded" ? decision : "pending";
    }

    function decisionLabel(decision: RevisionDecision): string {
        return { pending: "待处理", included: "纳入报告", excluded: "不纳入" }[decision];
    }

    function dateStamp(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    return { buildWorkbook, buildWorkbookBytes, exportWorkbook, formatPercent };
}
