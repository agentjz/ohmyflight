type CrewRosterEntry = {
    id: string;
    name: string;
    department: string;
    techInfo: string;
    techLevel: string;
};

type CrewExportColumn = {
    header: string;
    valuesByEmployeeId: Record<string, string>;
};

type CrewExportOptions = {
    includeTechLevel?: boolean;
};

type CrewMatchNameIdLogicApi = {
    parseRosterRows: (rows: unknown[][]) => CrewRosterEntry[];
    extractTechLevel: (techInfo: unknown) => string;
    buildExportRows: (
        entries: CrewRosterEntry[],
        customColumns?: CrewExportColumn[],
        options?: CrewExportOptions
    ) => string[][];
    resolveImageTitle: (value: unknown) => string;
};

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function normalizeHeader(value: unknown): string {
    return normalizeText(value).replace(/\s+/g, "");
}

function findHeaderIndex(headers: unknown[], keyword: string, fallbackIndex: number): number {
    const hitIndex = headers.findIndex((header) => {
        const normalized = normalizeHeader(header);
        return normalized === keyword || normalized.includes(keyword);
    });
    return hitIndex >= 0 ? hitIndex : fallbackIndex;
}

function findRequiredHeaderIndex(headers: unknown[], keyword: string): number {
    const index = findHeaderIndex(headers, keyword, -1);
    if (index < 0) {
        throw new Error(`花名册缺少必需列：${keyword}`);
    }
    return index;
}

function extractTechLevel(techInfo: unknown): string {
    const raw = normalizeText(techInfo);
    if (!raw) return "";

    const compact = raw.toUpperCase().replace(/\s+/g, "");
    const afterColon = compact.split(/[:：]/).slice(1).join(":");
    const content = afterColon || compact;

    const classTypeMatch = content.match(/([A-Z]\d{0,2})类/);
    if (classTypeMatch && classTypeMatch[1]) {
        return classTypeMatch[1];
    }

    const instructorMatch = content.match(/飞行教员([A-Z]\d{0,2})/);
    if (instructorMatch && instructorMatch[1]) {
        return instructorMatch[1];
    }

    const suffixMatch = content.match(/([A-Z]\d{0,2})$/);
    if (suffixMatch && suffixMatch[1]) {
        return suffixMatch[1];
    }

    return "";
}

function parseRosterRows(rows: unknown[][]): CrewRosterEntry[] {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
    const hasNamedHeader = headerRow.some((cell) => normalizeHeader(cell).includes("员工号"))
        && headerRow.some((cell) => normalizeHeader(cell).includes("姓名"))
        && headerRow.some((cell) => normalizeHeader(cell).includes("分部"));

    if (!hasNamedHeader) {
        throw new Error("花名册表头必须包含：员工号、姓名、分部");
    }

    const idIndex = findRequiredHeaderIndex(headerRow, "员工号");
    const nameIndex = findRequiredHeaderIndex(headerRow, "姓名");
    const departmentIndex = findRequiredHeaderIndex(headerRow, "分部");
    const techInfoIndex = findHeaderIndex(headerRow, "技术信息", -1);
    const startRowIndex = 1;

    const parsed: CrewRosterEntry[] = [];

    for (let i = startRowIndex; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;

        const id = normalizeText(row[idIndex]);
        const name = normalizeText(row[nameIndex]);
        if (!id || !name) continue;

        const techInfo = techInfoIndex >= 0 ? normalizeText(row[techInfoIndex]) : "";
        parsed.push({
            id,
            name,
            department: normalizeText(row[departmentIndex]),
            techInfo,
            techLevel: extractTechLevel(techInfo)
        });
    }

    return parsed;
}

function buildExportRows(
    entries: CrewRosterEntry[],
    customColumns: CrewExportColumn[] = [],
    options: CrewExportOptions = {}
): string[][] {
    const headers = ["员工号", "姓名", "分部", "技术信息"];
    if (options.includeTechLevel) headers.push("技术等级");
    headers.push(...customColumns.map((column) => normalizeText(column.header)));

    const rows = entries.map((entry) => {
        const fixedValues = [
            entry.id,
            entry.name,
            entry.department,
            entry.techInfo
        ];
        if (options.includeTechLevel) fixedValues.push(entry.techLevel);
        return [
            ...fixedValues,
            ...customColumns.map((column) => column.valuesByEmployeeId[entry.id] ?? "")
        ];
    });

    return [headers, ...rows];
}

function resolveImageTitle(value: unknown): string {
    return normalizeText(value) || "人员名单";
}

const CrewMatchNameIdLogic: CrewMatchNameIdLogicApi = {
    parseRosterRows,
    extractTechLevel,
    buildExportRows,
    resolveImageTitle
};

const runtime = globalThis as typeof globalThis & {
    CrewMatchNameIdLogic?: CrewMatchNameIdLogicApi;
};

runtime.CrewMatchNameIdLogic = CrewMatchNameIdLogic;
