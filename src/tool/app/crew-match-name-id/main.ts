const ROSTER_PATH = "../../../template/机组花名册.xlsx";

type CrewRosterEntry = {
    id: string;
    name: string;
    department: string;
    techInfo: string;
    techLevel: string;
};

type CrewMatchResult = CrewRosterEntry & {
    pos: number;
};

type CrewCustomColumn = {
    id: string;
    header: string;
    valuesByEmployeeId: Record<string, string>;
};

type CrewExportOptions = {
    includeTechLevel?: boolean;
};

type CrewMatchNameIdLogicApi = {
    parseRosterRows: (rows: unknown[][]) => CrewRosterEntry[];
};

type CrewMatchNameIdExporterApi = {
    buildExcelWorkbook: (
        entries: CrewRosterEntry[],
        customColumns: CrewCustomColumn[],
        options?: CrewExportOptions
    ) => import("xlsx-js-style").WorkBook;
    exportExcel: (
        entries: CrewRosterEntry[],
        customColumns: CrewCustomColumn[],
        options?: CrewExportOptions
    ) => void;
    exportImage: (
        entries: CrewRosterEntry[],
        customColumns: CrewCustomColumn[],
        imageTitle: string,
        options?: CrewExportOptions
    ) => Promise<void>;
};

type CrewMatchNameIdTableEditorApi = {
    initialize: () => void;
    setResults: (results: CrewMatchResult[]) => void;
    clear: () => void;
    getCurrentExportResults: () => CrewMatchResult[];
    getCustomColumns: () => CrewCustomColumn[];
};

let employeeData: CrewRosterEntry[] = [];

document.addEventListener("DOMContentLoaded", () => {
    getTableEditorApi().initialize();
    void loadDefaultRoster();
});

function requireElement<T extends HTMLElement>(id: string, Type: { new(): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof Type)) throw new Error(`页面缺少必要元素：${id}`);
    return element;
}

function getRuntime() {
    return globalThis as typeof globalThis & {
        XLSX?: typeof import("xlsx-js-style");
        CrewMatchNameIdLogic?: CrewMatchNameIdLogicApi;
        CrewMatchNameIdExporter?: CrewMatchNameIdExporterApi;
        CrewMatchNameIdTableEditor?: CrewMatchNameIdTableEditorApi;
    };
}

function getLogicApi(): CrewMatchNameIdLogicApi {
    const logic = getRuntime().CrewMatchNameIdLogic;
    if (!logic || typeof logic.parseRosterRows !== "function") {
        throw new Error("缺少 CrewMatchNameIdLogic，请确认 logic.js 已先于 main.js 加载。");
    }
    return logic;
}

function getExporterApi(): CrewMatchNameIdExporterApi {
    const exporter = getRuntime().CrewMatchNameIdExporter;
    if (!exporter) throw new Error("缺少名单导出组件，请刷新页面后重试。");
    return exporter;
}

function getTableEditorApi(): CrewMatchNameIdTableEditorApi {
    const editor = getRuntime().CrewMatchNameIdTableEditor;
    if (!editor) throw new Error("缺少名单编辑组件，请刷新页面后重试。");
    return editor;
}

function getXlsxApi(): typeof import("xlsx-js-style") {
    const xlsx = getRuntime().XLSX;
    if (!xlsx) throw new Error("Excel 组件未加载，请刷新页面后重试。");
    return xlsx;
}

async function loadDefaultRoster(): Promise<void> {
    try {
        showFileStatus("正在加载默认花名册...", "loading");
        const response = await fetch(ROSTER_PATH);
        if (!response.ok) throw new Error("文件不存在");
        const buffer = await response.arrayBuffer();
        parseExcelData(new Uint8Array(buffer), "机组花名册.xlsx");
    } catch (error) {
        console.error("自动加载花名册失败:", error);
        showFileStatus("请选择员工花名册文件", "hint");
    }
}

function parseExcelData(data: Uint8Array, fileName: string): void {
    try {
        const XLSX = getXlsxApi();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        employeeData = getLogicApi().parseRosterRows(rows);
        showFileStatus(`已加载: ${fileName}（${employeeData.length} 条数据）`, "success");
        requireElement("searchBtn", HTMLButtonElement).disabled = false;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showFileStatus("文件解析失败: " + message, "error");
    }
}

function showFileStatus(message: string, type: "success" | "error" | "loading" | "hint"): void {
    const status = requireElement("fileStatus", HTMLElement);
    const colors = {
        success: ["var(--omf-success-bg)", "var(--omf-success-text)"],
        error: ["var(--omf-danger-bg)", "var(--omf-danger-text)"],
        loading: ["var(--omf-info-bg)", "var(--omf-info-text)"],
        hint: ["var(--omf-surface-soft)", "var(--omf-text-muted)"]
    } as const;
    status.textContent = message;
    status.style.display = "inline-block";
    status.style.background = colors[type][0];
    status.style.color = colors[type][1];
}

function executeSearch(): void {
    const text = requireElement("textInput", HTMLTextAreaElement).value;
    if (!text.trim()) {
        alert("请输入要查询的文本");
        return;
    }

    const results = employeeData
        .map((employee) => ({ ...employee, pos: text.indexOf(employee.name) }))
        .filter((employee) => employee.pos !== -1)
        .sort((left, right) => left.pos - right.pos);
    getTableEditorApi().setResults(results);
}

function clearCurrentList(): void {
    requireElement("textInput", HTMLTextAreaElement).value = "";
    requireElement("imageTitleInput", HTMLInputElement).value = "人员名单";
    getTableEditorApi().clear();
    requireElement("textInput", HTMLTextAreaElement).focus();
}

function getExportOptions(): CrewExportOptions {
    return {
        includeTechLevel: requireElement("includeTechLevelInput", HTMLInputElement).checked
    };
}

function bindCopyButton(
    buttonId: string,
    buttonText: string,
    valueSelector: (employee: CrewMatchResult) => string
): void {
    requireElement(buttonId, HTMLButtonElement).addEventListener("click", function () {
        const results = getTableEditorApi().getCurrentExportResults();
        if (!results.length) {
            alert("没有可复制的数据，请先查询匹配。");
            return;
        }
        void copyToClipboard(results.map(valueSelector).join("\n"), this, buttonText);
    });
}

async function copyToClipboard(text: string, button: HTMLButtonElement, originalText: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        button.textContent = "已复制";
        button.style.backgroundColor = "var(--omf-success-bg)";
        button.style.color = "var(--omf-success-text)";
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = "";
            button.style.color = "";
        }, 1600);
    } catch {
        alert("复制失败，请手动选择文本复制。");
    }
}

requireElement("fileInput", HTMLInputElement).addEventListener("change", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        if (result instanceof ArrayBuffer) parseExcelData(new Uint8Array(result), file.name);
        else showFileStatus("文件解析失败: 读取结果不是二进制数据", "error");
    };
    reader.readAsArrayBuffer(file);
});

requireElement("searchBtn", HTMLButtonElement).addEventListener("click", executeSearch);
requireElement("clearBtn", HTMLButtonElement).addEventListener("click", clearCurrentList);

bindCopyButton("copyIdBtn", "复制员工号列", (employee) => employee.id);
bindCopyButton("copyNameBtn", "复制姓名列", (employee) => employee.name);

requireElement("exportExcelBtn", HTMLButtonElement).addEventListener("click", () => {
    const editor = getTableEditorApi();
    const results = editor.getCurrentExportResults();
    if (!results.length) {
        alert("没有可导出的数据，请先查询匹配。");
        return;
    }
    try {
        getExporterApi().exportExcel(results, editor.getCustomColumns(), getExportOptions());
    } catch (error) {
        alert(error instanceof Error ? error.message : String(error));
    }
});

requireElement("exportImageBtn", HTMLButtonElement).addEventListener("click", async function () {
    const editor = getTableEditorApi();
    const results = editor.getCurrentExportResults();
    if (!results.length) {
        alert("没有可导出的数据，请先查询匹配。");
        return;
    }
    const originalText = this.textContent || "导出图片";
    this.disabled = true;
    this.textContent = "生成中...";
    try {
        await getExporterApi().exportImage(
            results,
            editor.getCustomColumns(),
            requireElement("imageTitleInput", HTMLInputElement).value,
            getExportOptions()
        );
    } catch (error) {
        alert(error instanceof Error ? error.message : String(error));
    } finally {
        this.disabled = false;
        this.textContent = originalText;
    }
});
