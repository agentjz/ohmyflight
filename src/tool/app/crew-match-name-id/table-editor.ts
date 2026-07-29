const BASE_RESULT_COL_COUNT = 6;

type CrewTableEntry = {
    id: string;
    name: string;
    department: string;
    techInfo: string;
    techLevel: string;
    pos: number;
};

type CrewTableCustomColumn = {
    id: string;
    header: string;
    valuesByEmployeeId: Record<string, string>;
};

type CrewMatchNameIdTableEditorApi = {
    initialize: () => void;
    setResults: (results: CrewTableEntry[]) => void;
    clear: () => void;
    getCurrentExportResults: () => CrewTableEntry[];
    getCustomColumns: () => CrewTableCustomColumn[];
};

let tableResults: CrewTableEntry[] = [];
let tableCustomColumns: CrewTableCustomColumn[] = [];
let tableSelectedEmployeeIds = new Set<string>();
let nextTableCustomColumnId = 1;
let tableEmptyMessage = "匹配结果将显示在这里...";
let tableEditorInitialized = false;

function requireTableElement<T extends HTMLElement>(id: string, Type: { new(): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof Type)) throw new Error(`页面缺少必要元素：${id}`);
    return element;
}

function renderResultTable(): void {
    renderResultHeader();
    renderResultBody();
    requireTableElement("countInfo", HTMLElement).textContent = `匹配到 ${tableResults.length} 个员工`;
    requireTableElement("resultTable", HTMLTableElement).style.minWidth = `${900 + tableCustomColumns.length * 170}px`;
}

function renderResultHeader(): void {
    const resultHead = requireTableElement("resultHead", HTMLTableSectionElement);
    const customHeaders = tableCustomColumns.map((column) => `
        <th class="col-custom">
            <div class="custom-header-wrap">
                <input class="custom-header-input" data-column-id="${escapeTableHtml(column.id)}" value="${escapeTableHtml(column.header)}" aria-label="自定义列名">
                <button class="remove-column-btn" data-column-id="${escapeTableHtml(column.id)}" type="button" title="删除此列" aria-label="删除此列">&times;</button>
            </div>
        </th>
    `).join("");

    resultHead.innerHTML = `
        <tr>
            <th class="col-select"><input type="checkbox" id="selectAll" title="全选" aria-label="全选"></th>
            <th class="col-id">员工号</th>
            <th class="col-name">姓名</th>
            <th class="col-department">分部</th>
            <th class="col-tech-info">技术信息</th>
            <th class="col-tech-level">技术等级</th>
            ${customHeaders}
        </tr>
    `;
    updateSelectAllState();
}

function renderResultBody(): void {
    const resultBody = requireTableElement("resultBody", HTMLTableSectionElement);
    if (!tableResults.length) {
        resultBody.innerHTML = `<tr><td colspan="${BASE_RESULT_COL_COUNT + tableCustomColumns.length}" class="no-result">${escapeTableHtml(tableEmptyMessage)}</td></tr>`;
        return;
    }

    resultBody.innerHTML = tableResults.map((employee) => {
        const selected = tableSelectedEmployeeIds.has(employee.id);
        const customCells = tableCustomColumns.map((column) => `
            <td class="col-custom">
                <input
                    class="custom-value-input"
                    data-column-id="${escapeTableHtml(column.id)}"
                    data-employee-id="${escapeTableHtml(employee.id)}"
                    value="${escapeTableHtml(column.valuesByEmployeeId[employee.id] ?? "")}"
                    aria-label="${escapeTableHtml(column.header || "自定义列")} ${escapeTableHtml(employee.name)}"
                >
            </td>
        `).join("");

        return `
            <tr class="${selected ? "selected" : ""}">
                <td class="col-select"><input type="checkbox" class="row-check" data-employee-id="${escapeTableHtml(employee.id)}" ${selected ? "checked" : ""} aria-label="选择 ${escapeTableHtml(employee.name)}"></td>
                <td class="col-id">${escapeTableHtml(employee.id)}</td>
                <td class="col-name">${escapeTableHtml(employee.name)}</td>
                <td class="col-department">${escapeTableHtml(employee.department)}</td>
                <td class="col-tech-info">${escapeTableHtml(employee.techInfo)}</td>
                <td class="col-tech-level">${escapeTableHtml(employee.techLevel)}</td>
                ${customCells}
            </tr>
        `;
    }).join("");
}

function updateSelectAllState(): void {
    const selectAll = document.getElementById("selectAll");
    if (!(selectAll instanceof HTMLInputElement)) return;
    const selectedCount = tableResults.filter((employee) => tableSelectedEmployeeIds.has(employee.id)).length;
    selectAll.checked = tableResults.length > 0 && selectedCount === tableResults.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < tableResults.length;
}

function addTableCustomColumn(): void {
    if (!tableResults.length) {
        alert("请先查询匹配，再新增自定义列。");
        return;
    }
    const column: CrewTableCustomColumn = {
        id: `custom-${nextTableCustomColumnId++}`,
        header: `新增列 ${tableCustomColumns.length + 1}`,
        valuesByEmployeeId: {}
    };
    tableCustomColumns.push(column);
    renderResultTable();
    const input = document.querySelector<HTMLInputElement>(`.custom-header-input[data-column-id="${column.id}"]`);
    input?.focus();
    input?.select();
}

function removeTableCustomColumn(columnId: string): void {
    tableCustomColumns = tableCustomColumns.filter((column) => column.id !== columnId);
    renderResultTable();
}

function updateTableCustomValue(columnId: string, employeeId: string, value: string): void {
    const column = tableCustomColumns.find((item) => item.id === columnId);
    if (column) column.valuesByEmployeeId[employeeId] = value;
}

function pasteTableCustomColumn(event: ClipboardEvent, input: HTMLInputElement): void {
    const lines = (event.clipboardData?.getData("text") || "").replace(/\r/g, "").split("\n");
    while (lines.length > 1 && lines.at(-1) === "") lines.pop();
    if (lines.length <= 1) return;

    const columnId = input.dataset.columnId || "";
    const employeeId = input.dataset.employeeId || "";
    const startIndex = tableResults.findIndex((employee) => employee.id === employeeId);
    if (startIndex < 0) return;

    event.preventDefault();
    lines.forEach((value, offset) => {
        const employee = tableResults[startIndex + offset];
        if (employee) updateTableCustomValue(columnId, employee.id, value);
    });
    renderResultTable();
}

function bindTableEditorEvents(): void {
    requireTableElement("addColumnBtn", HTMLButtonElement).addEventListener("click", addTableCustomColumn);
    const resultHead = requireTableElement("resultHead", HTMLTableSectionElement);
    const resultBody = requireTableElement("resultBody", HTMLTableSectionElement);

    resultHead.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !target.classList.contains("custom-header-input")) return;
        const column = tableCustomColumns.find((item) => item.id === target.dataset.columnId);
        if (column) column.header = target.value;
    });
    resultHead.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement) || !target.classList.contains("remove-column-btn")) return;
        removeTableCustomColumn(target.dataset.columnId || "");
    });
    resultHead.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.id !== "selectAll") return;
        tableSelectedEmployeeIds = target.checked
            ? new Set(tableResults.map((employee) => employee.id))
            : new Set<string>();
        renderResultBody();
        updateSelectAllState();
    });
    resultBody.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !target.classList.contains("custom-value-input")) return;
        updateTableCustomValue(target.dataset.columnId || "", target.dataset.employeeId || "", target.value);
    });
    resultBody.addEventListener("paste", (event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.classList.contains("custom-value-input")) {
            pasteTableCustomColumn(event, target);
        }
    });
    resultBody.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !target.classList.contains("row-check")) return;
        const employeeId = target.dataset.employeeId || "";
        if (target.checked) tableSelectedEmployeeIds.add(employeeId);
        else tableSelectedEmployeeIds.delete(employeeId);
        target.closest("tr")?.classList.toggle("selected", target.checked);
        updateSelectAllState();
    });
}

function initializeTableEditor(): void {
    if (tableEditorInitialized) return;
    tableEditorInitialized = true;
    bindTableEditorEvents();
    renderResultTable();
}

function setTableResults(results: CrewTableEntry[]): void {
    tableResults = [...results];
    tableSelectedEmployeeIds.clear();
    tableEmptyMessage = results.length ? "" : "未找到匹配的员工";
    renderResultTable();
}

function clearTableEditor(): void {
    tableResults = [];
    tableCustomColumns = [];
    tableSelectedEmployeeIds = new Set<string>();
    nextTableCustomColumnId = 1;
    tableEmptyMessage = "匹配结果将显示在这里...";
    renderResultTable();
}

function getCurrentTableExportResults(): CrewTableEntry[] {
    const selected = tableResults.filter((employee) => tableSelectedEmployeeIds.has(employee.id));
    return selected.length ? selected : tableResults;
}

function escapeTableHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

(globalThis as typeof globalThis & { CrewMatchNameIdTableEditor?: CrewMatchNameIdTableEditorApi }).CrewMatchNameIdTableEditor = {
    initialize: initializeTableEditor,
    setResults: setTableResults,
    clear: clearTableEditor,
    getCurrentExportResults: getCurrentTableExportResults,
    getCustomColumns: () => tableCustomColumns
};
