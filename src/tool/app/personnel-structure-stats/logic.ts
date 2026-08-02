import type { PersonnelRecord, PersonnelStatItem, PersonnelStatSection, PersonnelStructureResult } from "./models";

export const REQUIRED_HEADERS = [
    "姓名",
    "技术信息",
    "RAMA",
    "REUO",
    "RWAS",
    "EAMA",
    "EEUO",
    "EWAS",
    "原单位",
    "检查员资格"
];

const QUALIFICATION_CODES = [
    "RAMA",
    "REUO",
    "RWAS",
    "RSEA",
    "EAMA",
    "EEUO",
    "EWAS",
    "ESEA",
    "RANC",
    "RORD",
    "RJFK",
    "RLAX",
    "RNLU"
];

const ORIGIN_LABELS = [
    "飞行/总队 777",
    "飞行/总队 737",
    "飞行/总队 320",
    "飞行/总队 909",
    "湖南",
    "湖北",
    "新疆",
    "河南",
    "西安",
    "重庆",
    "汕头",
    "珠海",
    "广西",
    "海南",
    "上海"
];

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function normalizeHeader(value: unknown): string {
    return normalizeText(value).replace(/\s+/g, "");
}

function hasValue(value: unknown): boolean {
    return value !== null && value !== undefined && normalizeText(value) !== "";
}

function findHeaderRowIndex(rows: unknown[][]): number {
    return rows.findIndex((row) => {
        if (!Array.isArray(row)) return false;
        const headers = row.map(normalizeHeader);
        return REQUIRED_HEADERS.filter((header) => headers.includes(header)).length >= 5;
    });
}

function buildHeaderMap(headerRow: unknown[]): Map<string, number> {
    const map = new Map<string, number>();
    headerRow.forEach((header, index) => {
        const normalized = normalizeHeader(header);
        if (normalized && !map.has(normalized)) {
            map.set(normalized, index);
        }
    });
    return map;
}

function valueByHeader(row: unknown[], headerMap: Map<string, number>, header: string): unknown {
    const index = headerMap.get(header);
    return index === undefined ? undefined : row[index];
}

export function parseRows(rows: unknown[][]): PersonnelRecord[] {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const headerRowIndex = findHeaderRowIndex(rows);
    if (headerRowIndex < 0) {
        throw new Error(`未识别到人员信息表表头，至少需要包含：${REQUIRED_HEADERS.join("、")}`);
    }

    const headerMap = buildHeaderMap(rows[headerRowIndex]);
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerMap.has(header));
    if (missingHeaders.length) {
        throw new Error(`人员信息表缺少必要表头：${missingHeaders.join("、")}`);
    }

    const records: PersonnelRecord[] = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!Array.isArray(row)) continue;

        const name = normalizeText(valueByHeader(row, headerMap, "姓名"));
        const techInfo = normalizeText(valueByHeader(row, headerMap, "技术信息"));
        const employeeId = normalizeText(valueByHeader(row, headerMap, "员工号"));
        if (!name && !techInfo && !employeeId) continue;

        const qualifications: Record<string, boolean> = {};
        QUALIFICATION_CODES.forEach((code) => {
            qualifications[code] = hasValue(valueByHeader(row, headerMap, code));
        });

        records.push({
            employeeId,
            name,
            techInfo,
            origin: normalizeText(valueByHeader(row, headerMap, "原单位")),
            inspectorQualification: normalizeText(valueByHeader(row, headerMap, "检查员资格")),
            qualifications
        });
    }

    return records;
}

function techLabel(record: PersonnelRecord): string {
    const parts = record.techInfo.split(/[:：]/);
    return normalizeText(parts.length > 1 ? parts.slice(1).join(":") : record.techInfo);
}

function isTeacher(record: PersonnelRecord): boolean {
    return techLabel(record).includes("飞行教员");
}

function isTransferCaptain(record: PersonnelRecord): boolean {
    return techLabel(record) === "划转机长";
}

function isTransferFirstOfficer(record: PersonnelRecord): boolean {
    return techLabel(record) === "划转副驾驶";
}

function isCaptain(record: PersonnelRecord): boolean {
    const label = techLabel(record);
    return label.includes("机长") && !label.includes("飞行教员") && !label.includes("划转");
}

function isRegularFirstOfficer(record: PersonnelRecord): boolean {
    const label = techLabel(record);
    return label.includes("副驾驶") && !label.includes("划转");
}

function isCaptainOrAbove(record: PersonnelRecord): boolean {
    return isTeacher(record) || isCaptain(record) || isTransferCaptain(record);
}

function isFirstOfficerGroup(record: PersonnelRecord): boolean {
    return isRegularFirstOfficer(record) || isTransferFirstOfficer(record);
}

function isStructureCrew(record: PersonnelRecord): boolean {
    return isTeacher(record)
        || isCaptain(record)
        || isTransferCaptain(record)
        || isRegularFirstOfficer(record)
        || isTransferFirstOfficer(record);
}

function hasQualification(record: PersonnelRecord, code: string): boolean {
    return Boolean(record.qualifications[code]);
}

function isLocal(record: PersonnelRecord): boolean {
    return record.origin.startsWith("总队") || record.origin === "777返聘";
}

function isInspector(record: PersonnelRecord): boolean {
    return record.inspectorQualification === "公司检查员" || record.inspectorQualification === "委任代表";
}

function isLineCaptain(record: PersonnelRecord): boolean {
    const label = techLabel(record);
    const isCaptainLevelForLine = label.includes("飞行教员")
        || label.includes("A类机长")
        || label.includes("B类机长")
        || label.includes("C类机长");
    return isCaptainLevelForLine
        && !label.includes("Z类机长")
        && !hasQualification(record, "RAMA")
        && !hasQualification(record, "REUO")
        && !hasQualification(record, "RWAS");
}

function percent(count: number, denominator: number): string {
    if (!denominator) return "0%";
    return `${Math.round((count / denominator) * 100)}%`;
}

function makeItem(
    label: string,
    count: number,
    denominator: number,
    rule: string,
    isSubset = false
): PersonnelStatItem {
    return {
        label,
        count,
        denominator,
        percent: percent(count, denominator),
        rule,
        isSubset
    };
}
function balancePercentages(items: PersonnelStatItem[], denominator: number): PersonnelStatItem[] {
    if (!items.length || denominator <= 0) {
        return items.map((item) => ({ ...item, percent: "0%" }));
    }

    const exactValues = items.map((item) => item.count / denominator * 100);
    const allocated = exactValues.map((value) => Math.floor(value));
    let remainder = 100 - allocated.reduce((sum, value) => sum + value, 0);
    const order = exactValues
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

    for (let index = 0; index < remainder; index++) {
        allocated[order[index % order.length].index] += 1;
    }

    return items.map((item, index) => ({ ...item, percent: `${allocated[index]}%` }));
}

function makeSection(
    title: string,
    denominatorLabel: string,
    items: PersonnelStatItem[],
    closureDenominator: number
): PersonnelStatSection {
    const total = items
        .filter((item) => !item.isSubset)
        .reduce((sum, item) => sum + item.count, 0);
    return {
        title,
        denominatorLabel,
        items,
        closure: {
            total,
            denominator: closureDenominator,
            closed: total === closureDenominator
        }
    };
}

type ClassifiedItemDefinition = {
    label: string;
    predicate: (record: PersonnelRecord) => boolean;
    rule: string;
};

function count(records: PersonnelRecord[], predicate: (record: PersonnelRecord) => boolean): number {
    return records.filter(predicate).length;
}

function formatPeople(records: PersonnelRecord[]): string {
    return records.map((record) => {
        const identity = [record.employeeId, record.name].filter(Boolean).join(" ");
        return identity || techLabel(record);
    }).join("、");
}

function makeClosedItems(
    records: PersonnelRecord[],
    denominator: number,
    definitions: ClassifiedItemDefinition[],
    otherRulePrefix: string
): PersonnelStatItem[] {
    const matched = new Set<PersonnelRecord>();
    const items = definitions.map((definition) => {
        const matchedRecords = records.filter((record) => definition.predicate(record));
        matchedRecords.forEach((record) => matched.add(record));
        return makeItem(definition.label, matchedRecords.length, denominator, definition.rule);
    });
    const otherRecords = records.filter((record) => !matched.has(record));
    if (otherRecords.length) {
        items.push(makeItem("其他", otherRecords.length, denominator, `${otherRulePrefix}：${formatPeople(otherRecords)}。`));
    }
    return balancePercentages(items, denominator);
}

function makeComboItems(
    records: PersonnelRecord[],
    denominator: number,
    prefix: "R" | "E",
    labels: {
        northOnly: string;
        europeOnly: string;
        westOnly: string;
        none: string;
    },
    rulePrefix: string
): PersonnelStatItem[] {
    const north = `${prefix}AMA`;
    const europe = `${prefix}EUO`;
    const west = `${prefix}WAS`;

    const comboCount = (expectedNorth: boolean, expectedEurope: boolean, expectedWest: boolean) => count(records, (record) =>
        hasQualification(record, north) === expectedNorth
        && hasQualification(record, europe) === expectedEurope
        && hasQualification(record, west) === expectedWest
    );

    return balancePercentages([
        makeItem("美+欧+西亚", comboCount(true, true, true), denominator, `${rulePrefix}：同时具备北美、欧洲、西亚。`),
        makeItem("美+欧", comboCount(true, true, false), denominator, `${rulePrefix}：具备北美、欧洲，不具备西亚。`),
        makeItem("美+西亚", comboCount(true, false, true), denominator, `${rulePrefix}：具备北美、西亚，不具备欧洲。`),
        makeItem("欧+西亚", comboCount(false, true, true), denominator, `${rulePrefix}：具备欧洲、西亚，不具备北美。`),
        makeItem(labels.northOnly, comboCount(true, false, false), denominator, `${rulePrefix}：只具备北美。`),
        makeItem(labels.europeOnly, comboCount(false, true, false), denominator, `${rulePrefix}：只具备欧洲。`),
        makeItem(labels.westOnly, comboCount(false, false, true), denominator, `${rulePrefix}：只具备西亚。`),
        makeItem(labels.none, comboCount(false, false, false), denominator, `${rulePrefix}：北美、欧洲、西亚均不具备。`)
    ], denominator);
}

function buildCaptainRouteItems(records: PersonnelRecord[], denominator: number): PersonnelStatItem[] {
    const comboItems = makeComboItems(records, denominator, "R", {
        northOnly: "仅北美带队",
        europeOnly: "仅欧洲带队",
        westOnly: "仅西亚带队",
        none: "无美欧西亚单飞"
    }, "RAMA/REUO/RWAS 单飞资格").filter((item) => item.label !== "无美欧西亚单飞");

    const matched = new Set<PersonnelRecord>();
    records.forEach((record) => {
        const hasNorth = hasQualification(record, "RAMA");
        const hasEurope = hasQualification(record, "REUO");
        const hasWest = hasQualification(record, "RWAS");
        const hasAnySingleFlight = hasNorth || hasEurope || hasWest;
        if (hasAnySingleFlight || isLineCaptain(record) || techLabel(record) === "Z类机长") {
            matched.add(record);
        }
    });

    const unmatched = records.filter((record) => !matched.has(record));

    return balancePercentages([
        ...comboItems,
        makeItem("航线机长", count(records, isLineCaptain), denominator, "B类及以上、无RAMA/REUO/RWAS单飞资格、且不是Z类机长。"),
        makeItem("左座带飞", count(records, (record) => techLabel(record) === "Z类机长"), denominator, "Z类机长。"),
        makeItem(
            "其他",
            unmatched.length,
            denominator,
            unmatched.length ? `不属于上述航线资格分类，需人工核对：${formatPeople(unmatched)}。` : "上述航线资格分类已覆盖全部人员。"
        )
    ], denominator);
}

function buildCaptainLevelItems(records: PersonnelRecord[], denominator: number): PersonnelStatItem[] {
    return [
        makeItem("检查员", count(records, isInspector), denominator, "其中：检查员资格为公司检查员或委任代表，不参加技术等级构成求和。", true),
        ...makeClosedItems(records, denominator, [
            {
                label: "C类教员",
                predicate: (record) => techLabel(record) === "飞行教员C",
                rule: "技术信息为飞行教员C。"
            },
            {
                label: "B类教员",
                predicate: (record) => techLabel(record) === "飞行教员B",
                rule: "技术信息为飞行教员B。"
            },
            {
                label: "A类教员",
                predicate: (record) => techLabel(record) === "飞行教员A",
                rule: "技术信息为飞行教员A。"
            },
            {
                label: "D类机长",
                predicate: (record) => techLabel(record) === "D类机长",
                rule: "技术信息为D类机长。"
            },
            {
                label: "C类机长",
                predicate: (record) => techLabel(record) === "C类机长",
                rule: "技术信息为C类机长。"
            },
            {
                label: "B类机长",
                predicate: (record) => techLabel(record) === "B类机长",
                rule: "技术信息为B类机长。"
            },
            {
                label: "Z类机长",
                predicate: (record) => techLabel(record) === "Z类机长",
                rule: "技术信息为Z类机长。"
            },
            {
                label: "转机型机长",
                predicate: isTransferCaptain,
                rule: "技术信息为划转机长，对外统一显示为转机型机长。"
            }
        ], "未落入教员/机长等级分类，需人工核对")
    ];
}

function buildFirstOfficerLevelItems(records: PersonnelRecord[], denominator: number): PersonnelStatItem[] {
    return makeClosedItems(records, denominator, [
        {
            label: "D类副驾驶",
            predicate: (record) => techLabel(record) === "D类副驾驶",
            rule: "技术信息为D类副驾驶。"
        },
        {
            label: "C类副驾驶",
            predicate: (record) => techLabel(record) === "C类副驾驶",
            rule: "技术信息为C类副驾驶。"
        },
        {
            label: "B类副驾驶",
            predicate: (record) => techLabel(record) === "B类副驾驶",
            rule: "技术信息为B类副驾驶。"
        },
        {
            label: "A类副驾驶",
            predicate: (record) => techLabel(record) === "A1类副驾驶" || techLabel(record) === "A2类副驾驶",
            rule: "技术信息为A1类副驾驶或A2类副驾驶。"
        },
        {
            label: "E类副驾驶",
            predicate: (record) => techLabel(record) === "E类副驾驶",
            rule: "技术信息为E类副驾驶。"
        },
        {
            label: "转机型副驾驶",
            predicate: isTransferFirstOfficer,
            rule: "技术信息为划转副驾驶，对外统一显示为转机型副驾驶。"
        }
    ], "未落入副驾驶等级分类，需人工核对");
}

function mapOrigin(origin: string): string {
    const normalized = normalizeText(origin);
    if (normalized === "总队777" || normalized === "777返聘") return "飞行/总队 777";
    if (normalized === "总队737") return "飞行/总队 737";
    if (normalized === "总队320") return "飞行/总队 320";
    if (normalized === "总队909") return "飞行/总队 909";
    if (normalized === "湖南分公司") return "湖南";
    if (normalized === "湖北分公司") return "湖北";
    if (normalized === "新疆分公司" || normalized === "新疆分公司（借）") return "新疆";
    if (normalized === "河南分公司") return "河南";
    if (normalized === "西安分公司") return "西安";
    if (normalized === "重庆航空") return "重庆";
    if (normalized === "汕头分公司") return "汕头";
    if (normalized === "珠海分公司") return "珠海";
    if (normalized === "广西分公司") return "广西";
    if (normalized === "海南分公司") return "海南";
    if (normalized === "上海分公司（借）") return "上海";
    return normalized || "未识别";
}

function uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

export function calculate(records: PersonnelRecord[]): PersonnelStructureResult {
    const structureCrew = records.filter(isStructureCrew);
    const captainBase = records.filter((record) => isTeacher(record) || isCaptain(record));
    const captainOrAbove = records.filter(isCaptainOrAbove);
    const firstOfficerBase = records.filter(isRegularFirstOfficer);
    const firstOfficerWithTransfer = records.filter(isFirstOfficerGroup);

    const structureCrewCount = structureCrew.length;
    const captainBaseDenominator = captainBase.length;
    const captainOrAboveCount = captainOrAbove.length;
    const firstOfficerBaseDenominator = firstOfficerBase.length;
    const firstOfficerCount = firstOfficerWithTransfer.length;

    const sections: PersonnelStatSection[] = [
        makeSection(
            "教员、机长、副驾驶占比",
            `${structureCrewCount}人`,
            balancePercentages([
                makeItem("教员", count(structureCrew, isTeacher), structureCrewCount, "技术信息包含飞行教员。"),
                makeItem("机长", count(structureCrew, (record) => isCaptain(record) || isTransferCaptain(record)), structureCrewCount, "非教员机长，含转机型机长。"),
                makeItem("副驾驶", count(structureCrew, (record) => isRegularFirstOfficer(record) || isTransferFirstOfficer(record)), structureCrewCount, "副驾驶，含转机型副驾驶。")
            ], structureCrewCount),
            structureCrewCount
        ),
        makeSection(
            "机长含以上各级别占比",
            `${captainOrAboveCount}人`,
            buildCaptainLevelItems(captainOrAbove, captainOrAboveCount),
            captainOrAboveCount
        ),
        makeSection(
            "机长航线资格占比",
            `${captainBaseDenominator}人，不含转机型`,
            buildCaptainRouteItems(captainBase, captainBaseDenominator),
            captainBaseDenominator
        ),
        makeSection(
            "机长报务占比",
            `${captainBaseDenominator}人，不含转机型`,
            makeComboItems(captainBase, captainBaseDenominator, "E", {
                northOnly: "单美洲报务",
                europeOnly: "单欧洲报务",
                westOnly: "单西亚报务",
                none: "无报务"
            }, "EAMA/EEUO/EWAS 英语通信资格"),
            captainBaseDenominator
        ),
        makeSection(
            "副驾驶级别占比",
            `${firstOfficerCount}人`,
            buildFirstOfficerLevelItems(firstOfficerWithTransfer, firstOfficerCount),
            firstOfficerCount
        ),
        makeSection(
            "副驾驶报务占比",
            `${firstOfficerBaseDenominator}人，不含转机型`,
            makeComboItems(firstOfficerBase, firstOfficerBaseDenominator, "E", {
                northOnly: "单美洲报务",
                europeOnly: "单欧洲报务",
                westOnly: "单西亚报务",
                none: "无报务"
            }, "EAMA/EEUO/EWAS 英语通信资格"),
            firstOfficerBaseDenominator
        ),
        makeSection(
            "人员居住情况",
            `${captainOrAboveCount}人 / ${firstOfficerCount}人`,
            [
                ...balancePercentages([
                    makeItem("机长本地居住", count(captainOrAbove, isLocal), captainOrAboveCount, "原单位以总队开头或等于777返聘。"),
                    makeItem("机长异地居住", count(captainOrAbove, (record) => !isLocal(record)), captainOrAboveCount, "除本地外均为异地。")
                ], captainOrAboveCount),
                ...balancePercentages([
                    makeItem("副驾驶本地居住", count(firstOfficerWithTransfer, isLocal), firstOfficerCount, "原单位以总队开头或等于777返聘。"),
                    makeItem("副驾驶异地居住", count(firstOfficerWithTransfer, (record) => !isLocal(record)), firstOfficerCount, "除本地外均为异地。")
                ], firstOfficerCount)
            ],
            structureCrewCount
        )
    ];

    const originCounts = new Map<string, number>();
    const originPeople = new Map<string, PersonnelRecord[]>();
    structureCrew.forEach((record) => {
        const label = mapOrigin(record.origin);
        originCounts.set(label, (originCounts.get(label) || 0) + 1);
        const people = originPeople.get(label) || [];
        people.push(record);
        originPeople.set(label, people);
    });
    const otherOriginEntries = Array.from(originCounts.entries())
        .filter(([label]) => !ORIGIN_LABELS.includes(label));
    const otherOriginCount = otherOriginEntries.reduce((sum, [, value]) => sum + value, 0);
    const otherOriginRule = otherOriginEntries.length
        ? `未映射原单位，需人工核对：${otherOriginEntries.map(([label]) => {
            const people = originPeople.get(label) || [];
            return `${label}（${formatPeople(people)}）`;
        }).join("；")}。`
        : "";

    sections.push(makeSection(
        "空勤人员原单位情况",
        `${structureCrewCount}人`,
        balancePercentages([
            ...ORIGIN_LABELS.map((label) => makeItem(label, originCounts.get(label) || 0, structureCrewCount, "按原单位映射汇总；总队777与777返聘合并到飞行/总队777。")),
            ...(otherOriginCount ? [makeItem("其他", otherOriginCount, structureCrewCount, otherOriginRule)] : [])
        ], structureCrewCount),
        structureCrewCount
    ));

    const recognizedTech = records.filter((record) =>
        isTeacher(record)
        || isCaptain(record)
        || isRegularFirstOfficer(record)
        || isTransferCaptain(record)
        || isTransferFirstOfficer(record)
    );
    const unrecognizedTech = uniqueSorted(records
        .filter((record) => record.techInfo && !recognizedTech.includes(record))
        .map((record) => record.techInfo));

    const unrecognizedOrigin = uniqueSorted(structureCrew
        .map((record) => record.origin)
        .filter((origin) => origin && !ORIGIN_LABELS.includes(mapOrigin(origin))));

    const warnings: string[] = [];
    if (unrecognizedTech.length) warnings.push(`有 ${unrecognizedTech.length} 类技术信息未识别。`);
    if (unrecognizedOrigin.length) warnings.push(`有 ${unrecognizedOrigin.length} 类原单位未映射。`);
    sections.forEach((section) => {
        section.items
            .filter((item) => item.label === "其他" && item.count > 0)
            .forEach((item) => warnings.push(`${section.title}：其他 ${item.count} 人，${item.rule}`));
        if (!section.closure.closed) {
            warnings.push(`${section.title}：构成合计 ${section.closure.total} 人，与母数 ${section.closure.denominator} 人不一致。`);
        }
    });

    return {
        structureCrewCount,
        captainOrAboveCount,
        firstOfficerCount,
        sections,
        warnings,
        unrecognized: {
            techInfo: unrecognizedTech,
            origin: unrecognizedOrigin
        }
    };
}
