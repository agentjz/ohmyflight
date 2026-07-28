type PersonnelWorkbook = import("xlsx-js-style").WorkBook;
type PersonnelWorksheet = import("xlsx-js-style").WorkSheet;

type PersonnelStatItem = {
    label: string;
    count: number;
    denominator: number;
    percent: string;
    rule: string;
    isSubset: boolean;
};

type PersonnelStatClosure = {
    total: number;
    denominator: number;
    closed: boolean;
};

type PersonnelStatSection = {
    title: string;
    denominatorLabel: string;
    items: PersonnelStatItem[];
    closure: PersonnelStatClosure;
};

type PersonnelStructureResult = {
    structureCrewCount: number;
    captainOrAboveCount: number;
    firstOfficerCount: number;
    sections: PersonnelStatSection[];
    warnings: string[];
    unrecognized: {
        techInfo: string[];
        origin: string[];
    };
};

type PersonnelStructureStatsApi = {
    parseRows: (rows: unknown[][]) => unknown[];
    calculate: (records: unknown[]) => PersonnelStructureResult;
    REQUIRED_HEADERS: string[];
};

type Elements = {
    fileInput: HTMLInputElement;
    sheetSelect: HTMLSelectElement;
    analyzeBtn: HTMLButtonElement;
    exportBtn: HTMLButtonElement;
    fileStatus: HTMLElement;
    summary: HTMLElement;
    resultSection: HTMLElement;
    resultTables: HTMLElement;
    warningSection: HTMLElement;
    warningList: HTMLElement;
};

let workbook: PersonnelWorkbook | null = null;
let sourceFileName = "人员结构统计";
let currentResult: PersonnelStructureResult | null = null;

const elements: Elements = {
    fileInput: requireElement("fileInput", HTMLInputElement),
    sheetSelect: requireElement("sheetSelect", HTMLSelectElement),
    analyzeBtn: requireElement("analyzeBtn", HTMLButtonElement),
    exportBtn: requireElement("exportBtn", HTMLButtonElement),
    fileStatus: requireElement("fileStatus", HTMLElement),
    summary: requireElement("summary", HTMLElement),
    resultSection: requireElement("resultSection", HTMLElement),
    resultTables: requireElement("resultTables", HTMLElement),
    warningSection: requireElement("warningSection", HTMLElement),
    warningList: requireElement("warningList", HTMLElement)
};

function requireElement<T extends HTMLElement>(id: string, Type: { new(): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof Type)) {
        throw new Error(`页面缺少必要元素：${id}`);
    }
    return element;
}

function getLogicApi(): PersonnelStructureStatsApi {
    const runtime = globalThis as typeof globalThis & {
        PersonnelStructureStats?: PersonnelStructureStatsApi;
    };

    if (!runtime.PersonnelStructureStats) {
        throw new Error("缺少 PersonnelStructureStats，请确认 logic.js 已加载。");
    }

    return runtime.PersonnelStructureStats;
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function showStatus(message: string, type: "success" | "error" | "hint" | "loading") {
    elements.fileStatus.textContent = message;
    elements.fileStatus.className = `status status-${type}`;
}

function stripExtension(fileName: string): string {
    return fileName.replace(/\.(xlsx|xls)$/i, "");
}

function timestamp(): string {
    const date = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function readSelectedRows(): unknown[][] {
    if (!workbook) throw new Error("请先上传人员信息表。");
    const sheetName = elements.sheetSelect.value || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName] as PersonnelWorksheet | undefined;
    if (!sheet) throw new Error(`未找到工作表：${sheetName}`);
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
}

function renderSheetOptions(sheetNames: string[]) {
    elements.sheetSelect.innerHTML = sheetNames
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join("");
    elements.sheetSelect.disabled = sheetNames.length <= 1;
}

async function handleFileChange(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;

    try {
        showStatus("正在读取文件...", "loading");
        const data = new Uint8Array(await file.arrayBuffer());
        workbook = XLSX.read(data, { type: "array", cellDates: true });
        sourceFileName = stripExtension(file.name);
        currentResult = null;
        renderSheetOptions(workbook.SheetNames);
        elements.analyzeBtn.disabled = false;
        elements.exportBtn.disabled = true;
        elements.resultSection.style.display = "none";
        elements.warningSection.style.display = "none";
        showStatus(`已加载：${file.name}（${workbook.SheetNames.length} 个工作表）`, "success");
    } catch (error) {
        workbook = null;
        elements.analyzeBtn.disabled = true;
        elements.exportBtn.disabled = true;
        showStatus(`文件解析失败：${error instanceof Error ? error.message : String(error)}`, "error");
    }
}

function handleAnalyze() {
    try {
        const rows = readSelectedRows();
        const api = getLogicApi();
        const records = api.parseRows(rows);
        const result = api.calculate(records);
        currentResult = result;
        renderResult(result);
        elements.exportBtn.disabled = false;
        showStatus(`统计完成：${result.structureCrewCount} 人，8 张表全部闭环`, "success");
    } catch (error) {
        currentResult = null;
        elements.exportBtn.disabled = true;
        elements.resultSection.style.display = "none";
        showStatus(`统计失败：${error instanceof Error ? error.message : String(error)}`, "error");
    }
}

function renderResult(result: PersonnelStructureResult) {
    elements.summary.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">结构统计人员</span>
            <strong class="summary-value">${result.structureCrewCount}</strong>
        </div>
        <div class="summary-item">
            <span class="summary-label">机长含以上</span>
            <strong class="summary-value">${result.captainOrAboveCount}</strong>
        </div>
        <div class="summary-item">
            <span class="summary-label">副驾驶</span>
            <strong class="summary-value">${result.firstOfficerCount}</strong>
        </div>
    `;

    elements.resultTables.innerHTML = result.sections.map((section) => `
        <div class="card mb-4">
            <div class="card-body">
                <div class="result-card-head">
                    <h5 class="card-title mb-0">${escapeHtml(section.title)}</h5>
                    <div class="result-card-meta">
                        <span>母数 ${escapeHtml(section.denominatorLabel)}</span>
                        <span>构成合计 ${section.closure.total} 人</span>
                        <strong class="closure-state ${section.closure.closed ? "is-closed" : "is-open"}">
                            ${section.closure.closed ? "已闭环" : "待核对"}
                        </strong>
                    </div>
                </div>
                <div class="table-responsive result-table-shell">
                    <table class="table table-hover align-middle result-table mb-0">
                        <thead>
                            <tr>
                                <th>项目</th>
                                <th>人数</th>
                                <th>占比</th>
                                <th>口径</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${section.items.map((item) => `
                                <tr class="${item.isSubset ? "subset-row" : ""}">
                                    <td>${item.isSubset ? "其中：" : ""}${escapeHtml(item.label)}</td>
                                    <td>${item.count}</td>
                                    <td>${escapeHtml(item.percent)}</td>
                                    <td>${escapeHtml(item.rule)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `).join("");

    const warnings = [
        ...result.warnings,
        ...result.unrecognized.techInfo.map((item) => `未识别技术信息：${item}`),
        ...result.unrecognized.origin.map((item) => `未映射原单位：${item}`)
    ];

    if (warnings.length) {
        elements.warningSection.style.display = "block";
        elements.warningList.innerHTML = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
    } else {
        elements.warningSection.style.display = "none";
        elements.warningList.innerHTML = "";
    }

    elements.resultSection.style.display = "block";
}

function buildResultRows(result: PersonnelStructureResult): unknown[][] {
    const rows: unknown[][] = [["表格", "项目", "统计关系", "人数", "母数", "占比", "口径"]];
    result.sections.forEach((section) => {
        section.items.forEach((item) => {
            rows.push([
                section.title,
                item.label,
                item.isSubset ? "其中项" : "构成项",
                item.count,
                item.denominator,
                item.percent,
                item.rule
            ]);
        });
    });
    return rows;
}

function buildClosureRows(result: PersonnelStructureResult): unknown[][] {
    return [
        ["表格", "构成合计", "闭环母数", "状态"],
        ...result.sections.map((section) => [
            section.title,
            section.closure.total,
            section.closure.denominator,
            section.closure.closed ? "已闭环" : "待核对"
        ])
    ];
}

function buildRuleRows(result: PersonnelStructureResult): unknown[][] {
    return [
        ["规则", "说明"],
        ["输入", "上传任意 xlsx/xls，按表头识别字段，不绑定文件名、sheet 名或列位置。"],
        ["必要表头", getLogicApi().REQUIRED_HEADERS.join("、")],
        ["结构统计人员", "教员、普通机长、转机型机长、普通副驾驶、转机型副驾驶。"],
        ["转机型机长", "技术信息为划转机长；航线资格和报务不包含转机型。"],
        ["转机型副驾驶", "技术信息为划转副驾驶；级别包含转机型，报务不包含转机型。"],
        ["检查员", "其中项，不参加机长技术等级构成求和。"],
        ["闭环", "每张表的构成项人数合计等于闭环母数；其中项不重复计入。"],
        ["单飞资格", "RAMA/REUO/RWAS 分别代表北美、欧洲、西亚单飞资格。"],
        ["报务资格", "EAMA/EEUO/EWAS 分别代表北美、欧洲、西亚英语通信资格。"],
        ["航线机长", "B类及以上、没有 RAMA/REUO/RWAS 单飞资格、且不是 Z类机长。"],
        ["左座带飞", "Z类机长。"],
        ["本地居住", "原单位以总队开头，或原单位为 777返聘。"],
        ["导出时间", new Date().toLocaleString("zh-CN")],
        ["结构统计人员", result.structureCrewCount],
        ["机长含以上", result.captainOrAboveCount],
        ["副驾驶", result.firstOfficerCount]
    ];
}

function buildUnrecognizedRows(result: PersonnelStructureResult): unknown[][] {
    const rows: unknown[][] = [["类型", "内容"]];
    result.unrecognized.techInfo.forEach((item) => rows.push(["未识别技术信息", item]));
    result.unrecognized.origin.forEach((item) => rows.push(["未映射原单位", item]));
    if (rows.length === 1) rows.push(["无", ""]);
    return rows;
}

function applySheetWidth(sheet: PersonnelWorksheet, widths: number[]) {
    sheet["!cols"] = widths.map((wch) => ({ wch }));
}

function handleExport() {
    if (!currentResult) return;

    const output = XLSX.utils.book_new();
    const resultSheet = XLSX.utils.aoa_to_sheet(buildResultRows(currentResult));
    const closureSheet = XLSX.utils.aoa_to_sheet(buildClosureRows(currentResult));
    const ruleSheet = XLSX.utils.aoa_to_sheet(buildRuleRows(currentResult));
    const unrecognizedSheet = XLSX.utils.aoa_to_sheet(buildUnrecognizedRows(currentResult));
    applySheetWidth(resultSheet, [24, 18, 12, 10, 10, 10, 58]);
    applySheetWidth(closureSheet, [28, 12, 12, 12]);
    applySheetWidth(ruleSheet, [20, 80]);
    applySheetWidth(unrecognizedSheet, [22, 42]);
    XLSX.utils.book_append_sheet(output, resultSheet, "统计结果");
    XLSX.utils.book_append_sheet(output, closureSheet, "闭环核对");
    XLSX.utils.book_append_sheet(output, ruleSheet, "规则说明");
    XLSX.utils.book_append_sheet(output, unrecognizedSheet, "未识别数据");
    XLSX.writeFile(output, `${sourceFileName}_人员结构统计_${timestamp()}.xlsx`);
}

elements.fileInput.addEventListener("change", handleFileChange);
elements.analyzeBtn.addEventListener("click", handleAnalyze);
elements.exportBtn.addEventListener("click", handleExport);
