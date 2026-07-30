(function () {
    const Data = window.SeasonalLearningData;
    const ACTUAL_REQUIRED_HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "培训类型", "日期", "期数", "身份"];
    const TOTAL_REQUIRED_HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "是否美线带队", "培训类型", "日期", "期数", "身份"];

    interface HealthRecord extends SeasonalLearningHealthPerson {
        periodText: string;
        dateText: string;
    }

    interface SheetScan {
        records: HealthRecord[];
        byEmployeeId: Map<string, HealthRecord>;
    }

    function normalizeText(value: unknown): string {
        return String(value ?? "").trim();
    }

    function buildHeaderMap(headers: unknown[]): Map<string, number> {
        const result = new Map<string, number>();
        headers.forEach((header, index) => {
            const name = normalizeText(header);
            if (name && !result.has(name)) result.set(name, index);
        });
        return result;
    }

    function cell(row: unknown[], headers: Map<string, number>, name: string): unknown {
        const index = headers.get(name);
        return index === undefined ? null : row[index];
    }

    function addItem(
        result: SeasonalLearningHealthResult,
        level: SeasonalLearningHealthLevel,
        area: string,
        message: string,
        detail = ""
    ): void {
        result.items.push({ level, area, message, detail });
        result.summary[level] += 1;
    }

    function personText(person: SeasonalLearningHealthPerson): string {
        return `${person.employeeId} / ${person.name || "姓名未填写"}（第${person.rowNumber}行）`;
    }

    function scanSheet(
        result: SeasonalLearningHealthResult,
        rows: unknown[][],
        label: string,
        requiredHeaders: string[],
        requirePeriod: boolean
    ): SheetScan {
        const headers = buildHeaderMap(rows[0] || []);
        const missingHeaders = requiredHeaders.filter((header) => !headers.has(header));
        if (missingHeaders.length) {
            addItem(result, "error", label, `缺少必要表头：${missingHeaders.join("、")}。`);
        }

        const records: HealthRecord[] = [];
        rows.slice(1).forEach((row, index) => {
            const rowNumber = index + 2;
            const employeeId = Data.normalizeEmployeeId(cell(row, headers, "员工号"));
            const name = normalizeText(cell(row, headers, "姓名"));
            if (!employeeId && !name) return;
            if (!employeeId) {
                addItem(result, "error", label, `第${rowNumber}行缺少员工号。`, name || "姓名也未填写");
                return;
            }
            records.push({
                employeeId,
                name,
                identity: normalizeText(cell(row, headers, "身份")),
                periodText: requirePeriod ? normalizeText(cell(row, headers, "期数")) : "",
                dateText: requirePeriod ? normalizeText(cell(row, headers, "日期")) : "",
                rowNumber
            });
        });

        const grouped = new Map<string, HealthRecord[]>();
        records.forEach((record) => {
            const group = grouped.get(record.employeeId) || [];
            group.push(record);
            grouped.set(record.employeeId, group);
        });
        grouped.forEach((group, employeeId) => {
            if (group.length < 2) return;
            addItem(
                result,
                "error",
                label,
                `员工号 ${employeeId} 重复出现。`,
                group.map(personText).join("；")
            );
        });

        return {
            records,
            byEmployeeId: new Map(records.map((record) => [record.employeeId, record]))
        };
    }

    function sortedPeople(people: SeasonalLearningHealthPerson[]): SeasonalLearningHealthPerson[] {
        return [...people].sort((left, right) => left.rowNumber - right.rowNumber);
    }

    function buildWorkbookHealth(totalRows: unknown[][], actualRows: unknown[][]): SeasonalLearningHealthResult {
        const result: SeasonalLearningHealthResult = {
            summary: { error: 0, warning: 0, info: 0 },
            items: [],
            totalCount: 0,
            actualCount: 0,
            totalTagged: [],
            totalUntagged: [],
            actualTagged: [],
            actualUntagged: []
        };
        const total = scanSheet(result, totalRows, "换季总名单", TOTAL_REQUIRED_HEADERS, false);
        const actual = scanSheet(result, actualRows, "换季实际", ACTUAL_REQUIRED_HEADERS, true);
        const totalPeople = [...total.byEmployeeId.values()];
        const actualPeople = [...actual.byEmployeeId.values()];

        result.totalCount = total.records.length;
        result.actualCount = actual.records.length;
        result.totalTagged = sortedPeople(totalPeople.filter((person) => Boolean(person.identity)));
        result.totalUntagged = sortedPeople(totalPeople.filter((person) => !person.identity));
        result.actualTagged = sortedPeople(actualPeople.filter((person) => Boolean(person.identity)));
        result.actualUntagged = sortedPeople(actualPeople.filter((person) => !person.identity));

        addItem(
            result,
            "info",
            "身份标记",
            `总名单 ${result.totalTagged.length} 人有身份，${result.totalUntagged.length} 人未标身份。`
        );

        if (!actual.records.length) {
            addItem(result, "info", "换季实际", "尚未生成实际安排。", `总名单当前有 ${result.totalCount} 人。`);
            return result;
        }

        addItem(
            result,
            result.totalCount === result.actualCount ? "info" : "warning",
            "名单人数",
            `总名单 ${result.totalCount} 人，实际名单 ${result.actualCount} 人。`
        );
        addItem(
            result,
            "info",
            "身份标记",
            `实际名单 ${result.actualTagged.length} 人有身份，${result.actualUntagged.length} 人未标身份。`
        );

        const missing = totalPeople.filter((person) => !actual.byEmployeeId.has(person.employeeId));
        const extra = actualPeople.filter((person) => !total.byEmployeeId.has(person.employeeId));
        if (missing.length) {
            addItem(result, "warning", "名单对应", `实际名单缺少 ${missing.length} 人。`, missing.map(personText).join("；"));
        }
        if (extra.length) {
            addItem(result, "warning", "名单对应", `实际名单多出 ${extra.length} 人。`, extra.map(personText).join("；"));
        }
        if (!missing.length && !extra.length) {
            addItem(result, "info", "名单对应", "总名单与实际名单员工号完全一致。");
        }

        const unassigned = actualPeople.filter((person) => !person.periodText || !person.dateText);
        if (unassigned.length) {
            addItem(result, "warning", "实际排期", `有 ${unassigned.length} 人日期或期数不完整，导入后进入待分配。`, unassigned.map(personText).join("；"));
        } else {
            addItem(result, "info", "实际排期", "实际名单全部填写了日期和期数。");
        }

        const identityMismatches = totalPeople.flatMap((person) => {
            const actualPerson = actual.byEmployeeId.get(person.employeeId);
            if (!actualPerson || actualPerson.identity === person.identity) return [];
            return [{ total: person, actual: actualPerson }];
        });
        if (identityMismatches.length) {
            addItem(
                result,
                "warning",
                "身份一致性",
                `有 ${identityMismatches.length} 人身份不一致。`,
                identityMismatches.map(({ total: totalPerson, actual: actualPerson }) => (
                    `${personText(totalPerson)}：总名单“${totalPerson.identity || "空"}”，实际名单“${actualPerson.identity || "空"}”`
                )).join("；")
            );
        } else {
            addItem(result, "info", "身份一致性", "两张表的身份标记一致。");
        }

        return result;
    }

    window.SeasonalLearningHealth = { buildWorkbookHealth };
})();
