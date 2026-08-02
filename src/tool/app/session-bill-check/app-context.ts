import type * as XLSX from "xlsx-js-style";

import type {
    SessionBillAppContext,
    SessionBillAppState,
    SessionBillCompareRow,
    SessionBillEcharts,
    SessionBillLogicApi,
    SessionBillWorkbook
} from "./models";

export function createAppContext(
    xlsx: typeof XLSX,
    logic: SessionBillLogicApi,
    echarts: SessionBillEcharts | undefined
): SessionBillAppContext {
        const state: SessionBillAppState = {
            sessionWorkbook: null,
            billWorkbook: null,
            sessionFileName: "",
            billFileName: "",
            sessionAnalysis: null,
            billAnalysis: null,
            result: null,
            filter: "diff",
            selectedKey: ""
        };

        function getElement<T extends HTMLElement>(id: string): T {
            const element = document.getElementById(id);
            if (!element) throw new Error(`Missing element: ${id}`);
            return element as T;
        }

        function escapeHtml(value: unknown): string {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        function setStatus(message: string, type: "muted" | "success" | "danger" = "muted"): void {
            const status = getElement<HTMLDivElement>("statusLine");
            status.textContent = message;
            status.className = `small mt-2 text-${type === "danger" ? "danger" : type === "success" ? "success" : "muted"}`;
        }

        function readWorkbook(file: File): Promise<SessionBillWorkbook> {
            return file.arrayBuffer().then((buffer) => xlsx.read(buffer, {
                type: "array",
                cellFormula: true,
                cellStyles: true,
                cellDates: false
            }));
        }

        function filteredRows(): SessionBillCompareRow[] {
            const rows = state.result?.rows || [];
            if (state.filter === "all") return rows;
            if (state.filter === "diff") return rows.filter((row) => row.status !== "一致");
            return rows.filter((row) => row.status === state.filter);
        }

        return {
            XLSX: xlsx,
            echarts,
            logic,
            state,
            getElement,
            escapeHtml,
            setStatus,
            readWorkbook,
            filteredRows
        };
}
