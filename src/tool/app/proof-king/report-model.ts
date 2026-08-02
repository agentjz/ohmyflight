import type {
    DiffSegment,
    ManualRole,
    ReportTextRun,
    RevisionEvent,
    RevisionReportGroup,
    RevisionReportRow
} from "./models";

    function buildRows(events: RevisionEvent[]): RevisionReportRow[] {
        return events.map(buildRow);
    }

    function buildGroups(events: RevisionEvent[]): RevisionReportGroup[] {
        const groups: RevisionReportGroup[] = [];
        events.forEach((event) => {
            const row = buildRow(event);
            const identity = `${event.kind}|${normalizedTitle(row.title)}`;
            const current = groups[groups.length - 1];
            if (row.title !== "未识别小节"
                && current
                && current.kind === event.kind
                && normalizedTitle(current.title) === normalizedTitle(row.title)) {
                current.rows.push(row);
                return;
            }
            groups.push({
                key: `${identity}|${groups.length + 1}`,
                kind: event.kind,
                chapter: row.chapter,
                number: row.number,
                title: row.title || "未识别小节",
                rows: [row]
            });
        });
        return groups;
    }

    function buildRow(event: RevisionEvent): RevisionReportRow {
        const number = sectionNumber(event.title);
        const title = stableTitle(event.title);
        return {
            kind: event.kind,
            chapter: number ? `第 ${number.split(".")[0]} 章` : "未识别章节",
            number,
            title,
            explanation: "",
            myLocation: event.myLocation,
            referenceLocation: event.referenceLocation,
            myRuns: diffRuns(event.myDiff || [], "my"),
            referenceRuns: diffRuns(event.referenceDiff || [], "reference")
        };
    }

    function sectionNumber(title: string): string {
        return String(title || "").normalize("NFKC").match(/^\s*(\d+(?:\.\d+)*)/)?.[1] || "";
    }

    function stableTitle(title: string): string {
        const value = String(title || "").normalize("NFKC").trim();
        return value && !["参考手册新增", "参考手册删除", "内容修改", "待人工确认"].includes(value)
            ? value
            : "未识别小节";
    }

    function normalizedTitle(title: string): string {
        return stableTitle(title).toLowerCase().replace(/\s+/g, "");
    }

    function diffRuns(segments: DiffSegment[], side: ManualRole): ReportTextRun[] {
        return segments.filter((segment) => !!segment.text).map((segment) => ({
            text: segment.text,
            color: segment.kind === "equal" ? "000000"
                : segment.kind === "removed" || side === "my" ? "FF0000" : "00B0F0"
        }));
    }

export const ManualProofReportModel = { buildRows, buildGroups, sectionNumber, diffRuns };
