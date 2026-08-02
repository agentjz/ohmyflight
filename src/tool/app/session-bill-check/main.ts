import type * as XLSX from "xlsx-js-style";

import { createAppContext } from "./app-context";
import { createSessionBillLogic } from "./logic";
import type { SessionBillAppContext, SessionBillEcharts } from "./models";
import { renderAll, renderTable } from "./view";

    function runCompare(context: SessionBillAppContext): void {
        if (!context.state.sessionAnalysis || !context.state.billAnalysis) {
            context.state.result = null;
            renderAll(context);
            return;
        }
        context.state.result = context.logic.compareEntries(context.state.sessionAnalysis.entries, context.state.billAnalysis.entries, {
            sessionSheetName: context.state.sessionAnalysis.sheetName,
            billSheetNames: context.state.billAnalysis.sheetNames
        });
        context.state.selectedKey = context.state.result.rows.find((row) => row.status !== "一致")?.key || context.state.result.rows[0]?.key || "";
        context.setStatus("核对完成。", "success");
        renderAll(context);
    }

    async function handleSessionFile(context: SessionBillAppContext, file: File): Promise<void> {
        context.state.sessionWorkbook = await context.readWorkbook(file);
        context.state.sessionFileName = file.name;
        context.state.sessionAnalysis = context.logic.analyzeSessionWorkbook(context.state.sessionWorkbook);
        runCompare(context);
    }

    async function handleBillFile(context: SessionBillAppContext, file: File): Promise<void> {
        context.state.billWorkbook = await context.readWorkbook(file);
        context.state.billFileName = file.name;
        context.state.billAnalysis = context.logic.analyzeBillWorkbook(context.state.billWorkbook);
        runCompare(context);
    }

    function bindFileInput(context: SessionBillAppContext, inputId: string, handler: (file: File) => Promise<void>): void {
        context.getElement<HTMLInputElement>(inputId).addEventListener("change", (event) => {
            const input = event.target as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            context.setStatus(`正在读取 ${file.name}...`);
            handler(file).catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                context.setStatus(message, "danger");
                renderAll(context);
            });
        });
    }

    function exportWorkbook(context: SessionBillAppContext): void {
        if (!context.state.result) return;
        context.XLSX.writeFile(context.logic.buildExportWorkbook(context.state.result), context.logic.buildOutputFileName());
    }

    function bindEvents(context: SessionBillAppContext): void {
        bindFileInput(context, "sessionFile", file => handleSessionFile(context, file));
        bindFileInput(context, "billFile", file => handleBillFile(context, file));
        context.getElement<HTMLSelectElement>("statusFilter").addEventListener("change", (event) => {
            context.state.filter = (event.target as HTMLSelectElement).value;
            renderTable(context);
        });
        context.getElement<HTMLButtonElement>("exportButton").addEventListener("click", () => exportWorkbook(context));
    }

    document.addEventListener("DOMContentLoaded", () => {
        const xlsx = window.XLSX as unknown as typeof XLSX;
        const echarts = (window as typeof window & { echarts?: SessionBillEcharts }).echarts;
        const context = createAppContext(xlsx, createSessionBillLogic(xlsx), echarts);
        bindEvents(context);
        renderAll(context);
    });
