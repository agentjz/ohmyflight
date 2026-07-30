(function () {
    const runtime = window;
    const namespace = runtime.SeasonalLearningApp || (runtime.SeasonalLearningApp = {});

    function createAppContext(): SeasonalLearningAppContext {
        const rules = runtime.SeasonalLearningBalanceRules;
        const state: SeasonalLearningAppState = {
            sourceWorkbook: null,
            sourceFileName: "",
            initialized: false,
            mode: null,
            scheduleReady: false,
            people: [],
            periodDates: {},
            periodCount: 6,
            addedEmployeeIds: [],
            removedPeople: [],
            adjustmentLog: [],
            pendingMoveIds: [],
            enabledBalanceHookIds: [...rules.DEFAULT_ENABLED_HOOK_IDS],
            health: null,
            chart: null
        };

        function getElement<T extends HTMLElement>(id: string): T {
            const element = document.getElementById(id);
            if (!element) throw new Error(`页面缺少必要元素：${id}`);
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

        function setMessage(id: string, message: string, type: "muted" | "success" | "warning" | "danger"): void {
            const element = getElement<HTMLElement>(id);
            element.textContent = message;
            element.classList.remove("status-muted", "status-success", "status-warning", "status-danger");
            element.classList.add("status-line", `status-${type}`);
        }

        function setStatus(message: string, type: "muted" | "success" | "warning" | "danger" = "muted"): void {
            setMessage("fileStatus", message, type);
        }

        function setActionMessage(message: string, type: "muted" | "success" | "warning" | "danger" = "muted"): void {
            setMessage("actionStatus", message, type);
            getElement<HTMLElement>("actionStatus").hidden = !message;
        }

        async function readWorkbook(file: File): Promise<import("xlsx-js-style").WorkBook> {
            const buffer = await file.arrayBuffer();
            return runtime.XLSX.read(buffer, {
                type: "array",
                cellDates: true,
                cellFormula: true,
                cellNF: true,
                cellStyles: true
            });
        }

        function sheetRows(workbook: import("xlsx-js-style").WorkBook, sheetName: string): unknown[][] {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) throw new Error(`未找到工作表：${sheetName}。`);
            return runtime.XLSX.utils.sheet_to_json<unknown[]>(sheet, {
                header: 1,
                raw: true,
                defval: null,
                blankrows: false
            });
        }

        function workbookUses1904Dates(workbook: import("xlsx-js-style").WorkBook): boolean {
            const metadata = workbook as import("xlsx-js-style").WorkBook & {
                Workbook?: { WBProps?: { date1904?: boolean } };
            };
            return metadata.Workbook?.WBProps?.date1904 === true;
        }

        return {
            runtime,
            logic: runtime.SeasonalLearningLogic,
            rules,
            exporter: runtime.SeasonalLearningExport,
            health: runtime.SeasonalLearningHealth,
            state,
            getElement,
            escapeHtml,
            setStatus,
            setActionMessage,
            readWorkbook,
            sheetRows,
            workbookUses1904Dates
        };
    }

    namespace.AppContext = { createAppContext };
})();
