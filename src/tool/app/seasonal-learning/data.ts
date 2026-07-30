(function () {
    const ACTUAL_REQUIRED_HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "培训类型", "日期", "期数", "身份"];
    const TOTAL_REQUIRED_HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "是否美线带队", "培训类型", "日期", "期数", "身份"];

    function normalizeText(value: unknown): string {
        return String(value ?? "").trim();
    }

    function pad(value: number): string {
        return String(value).padStart(2, "0");
    }

    function validDateKey(year: number, month: number, day: number): string {
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return "";
        const date = new Date(year, month - 1, day, 12, 0, 0, 0);
        if (
            date.getFullYear() !== year
            || date.getMonth() + 1 !== month
            || date.getDate() !== day
        ) return "";
        return `${year}-${pad(month)}-${pad(day)}`;
    }

    function excelSerialDateKey(serial: number, date1904: boolean): string {
        if (!Number.isFinite(serial) || serial < 0) return "";
        const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
        const date = new Date(epoch + Math.floor(serial) * 86400000);
        return validDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }

    function parseBusinessDate(value: unknown, options: { date1904?: boolean } = {}): string {
        if (value === undefined || value === null || value === "") return "";

        if (value instanceof Date && !Number.isNaN(value.valueOf())) {
            const rounded = value.getHours() === 23
                && value.getMinutes() === 59
                && value.getSeconds() === 59
                ? new Date(value.getTime() + 1000)
                : value;
            return validDateKey(rounded.getFullYear(), rounded.getMonth() + 1, rounded.getDate());
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            const integerText = Number.isInteger(value) ? String(value) : "";
            if (/^\d{8}$/.test(integerText)) {
                return validDateKey(
                    Number(integerText.slice(0, 4)),
                    Number(integerText.slice(4, 6)),
                    Number(integerText.slice(6, 8))
                );
            }
            return excelSerialDateKey(value, options.date1904 === true);
        }

        const text = normalizeText(value);
        let matched = text.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (!matched) {
            matched = text.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/);
        }
        if (!matched) {
            matched = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
        }
        return matched
            ? validDateKey(Number(matched[1]), Number(matched[2]), Number(matched[3]))
            : "";
    }

    function normalizeEmployeeId(value: unknown): string {
        if (typeof value === "number" && Number.isFinite(value)) {
            return Number.isInteger(value) ? String(value) : normalizeText(value);
        }
        return normalizeText(value);
    }

    function buildHeaderMap(headers: unknown[]): Map<string, number> {
        const result = new Map<string, number>();
        headers.forEach((header, index) => {
            const name = normalizeText(header);
            if (name && !result.has(name)) result.set(name, index);
        });
        return result;
    }

    function requireHeaders(rows: unknown[][], label: string, requiredHeaders: string[]): Map<string, number> {
        const headerMap = buildHeaderMap(rows[0] || []);
        const missing = requiredHeaders.filter((header) => !headerMap.has(header));
        if (missing.length) throw new Error(`${label}缺少必要表头：${missing.join("、")}。`);
        return headerMap;
    }

    function cell(row: unknown[], headers: Map<string, number>, name: string): unknown {
        const index = headers.get(name);
        return index === undefined ? null : row[index];
    }

    function isCheckedValue(value: unknown): boolean {
        if (value === true || value === 1) return true;
        return normalizeText(value) === "1";
    }

    function classifyPerson(isLeader: boolean, technicalInfo: string, rowNumber: number): SeasonalLearningCategory {
        if (isLeader) return "leader";
        if (technicalInfo.includes("副驾驶")) return "firstOfficer";
        if (technicalInfo.includes("机长") || technicalInfo.includes("飞行教员")) return "captain";
        throw new Error(`换季总名单第${rowNumber}行技术信息“${technicalInfo || "空"}”无法归类。`);
    }

    function parseSequence(value: unknown, fallback: number): string | number {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        const text = normalizeText(value);
        return text || fallback;
    }

    function readRosterRows(rows: unknown[][], options: { date1904?: boolean } = {}): SeasonalLearningPerson[] {
        const headers = requireHeaders(rows, "换季总名单", TOTAL_REQUIRED_HEADERS);
        const people: SeasonalLearningPerson[] = [];
        const seen = new Set<string>();

        rows.slice(1).forEach((row, index) => {
            const rowNumber = index + 2;
            const employeeId = normalizeEmployeeId(cell(row, headers, "员工号"));
            const name = normalizeText(cell(row, headers, "姓名"));
            if (!employeeId && !name) return;
            if (!employeeId) throw new Error(`换季总名单第${rowNumber}行缺少员工号。`);
            if (!name) throw new Error(`换季总名单第${rowNumber}行缺少姓名。`);
            if (seen.has(employeeId)) throw new Error(`换季总名单员工号重复：${employeeId}。`);
            seen.add(employeeId);

            const dateValue = cell(row, headers, "日期");
            const sourceDate = parseBusinessDate(dateValue, options);
            if (dateValue !== null && dateValue !== undefined && normalizeText(dateValue) && !sourceDate) {
                throw new Error(`换季总名单第${rowNumber}行日期无法解析。`);
            }
            const technicalInfo = normalizeText(cell(row, headers, "技术信息"));
            const isLeader = isCheckedValue(cell(row, headers, "是否带队"));

            people.push({
                sequence: parseSequence(cell(row, headers, "序号"), people.length + 1),
                originalOrder: people.length,
                sourceRow: rowNumber,
                employeeId,
                name,
                department: normalizeText(cell(row, headers, "分部")),
                technicalInfo,
                identity: normalizeText(cell(row, headers, "身份")),
                isLeader,
                isUsLineLeader: isCheckedValue(cell(row, headers, "是否美线带队")),
                trainingType: normalizeText(cell(row, headers, "培训类型")),
                sourceDate,
                category: classifyPerson(isLeader, technicalInfo, rowNumber),
                period: null,
                adjusted: false,
                adjustmentNotes: []
            });
        });

        if (!people.length) throw new Error("换季总名单没有可用人员数据。");
        return people;
    }

    function parsePeriod(value: unknown, rowNumber: number): number | null {
        if (value === undefined || value === null || normalizeText(value) === "") return null;
        const text = normalizeText(value);
        const matched = text.match(/^(?:第)?(\d+)(?:期)?$/);
        const period = matched ? Number(matched[1]) : Number.NaN;
        if (!Number.isInteger(period) || period < 1 || period > 60) {
            throw new Error(`换季实际第${rowNumber}行期数无法解析。`);
        }
        return period;
    }

    interface ActualRecord extends SeasonalLearningRemovedPerson {
        date: string;
        adjustmentNotes: string[];
    }

    function readActualRows(rows: unknown[][], options: { date1904?: boolean }): ActualRecord[] {
        const headers = requireHeaders(rows, "换季实际", ACTUAL_REQUIRED_HEADERS);
        const noteIndex = buildHeaderMap(rows[0] || []).get("调整说明");
        const records: ActualRecord[] = [];
        const seen = new Set<string>();

        rows.slice(1).forEach((row, index) => {
            const rowNumber = index + 2;
            const employeeId = normalizeEmployeeId(cell(row, headers, "员工号"));
            if (!employeeId) return;
            if (seen.has(employeeId)) throw new Error(`换季实际员工号重复：${employeeId}。`);
            seen.add(employeeId);
            const dateValue = cell(row, headers, "日期");
            const date = parseBusinessDate(dateValue, options);
            if (dateValue !== null && dateValue !== undefined && normalizeText(dateValue) && !date) {
                throw new Error(`换季实际第${rowNumber}行日期无法解析。`);
            }
            const noteText = noteIndex === undefined ? "" : normalizeText(row[noteIndex]);
            const period = date ? parsePeriod(cell(row, headers, "期数"), rowNumber) : null;
            records.push({
                employeeId,
                name: normalizeText(cell(row, headers, "姓名")),
                department: normalizeText(cell(row, headers, "分部")),
                period,
                date,
                adjustmentNotes: noteText ? noteText.split(/[；;]/).map((note) => note.trim()).filter(Boolean) : []
            });
        });
        return records;
    }

    function clonePerson(person: SeasonalLearningPerson): SeasonalLearningPerson {
        return { ...person, adjustmentNotes: [...person.adjustmentNotes] };
    }

    function emptyPeriodDates(periodCount: number): Record<number, string> {
        return Object.fromEntries(Array.from({ length: periodCount }, (_, index) => [index + 1, ""]));
    }

    function validatePeriodCount(value: number): number {
        if (!Number.isInteger(value) || value < 1 || value > 30) throw new Error("期数必须是 1 到 30 的整数。");
        return value;
    }

    function buildImportResult(
        totalRows: unknown[][],
        actualRows: unknown[][],
        requestedPeriodCount: number,
        previousState: SeasonalLearningPreviousState | null,
        options: { date1904?: boolean } = {}
    ): SeasonalLearningImportResult {
        const roster = readRosterRows(totalRows, options);
        const actual = readActualRows(actualRows, options);
        const hasActualRoster = actual.length > 0;

        if (hasActualRoster) {
            const actualById = new Map(actual.map((record) => [record.employeeId, record]));
            const effectivePeriod = (record: ActualRecord): number | null => (
                record.date && record.period ? record.period : null
            );
            const maximumPeriod = Math.max(0, ...actual.map((record) => effectivePeriod(record) || 0));
            const periodCount = Math.max(validatePeriodCount(requestedPeriodCount), maximumPeriod);
            const periodDates = emptyPeriodDates(periodCount);

            actual.forEach((record) => {
                const period = effectivePeriod(record);
                if (!period) return;
                const current = periodDates[period];
                if (current && current !== record.date) {
                    throw new Error(`换季实际第${period}期存在多个培训日期。`);
                }
                periodDates[period] = record.date;
            });

            const people = roster.map((person) => {
                const record = actualById.get(person.employeeId);
                return record
                    ? {
                        ...person,
                        period: effectivePeriod(record),
                        adjusted: record.adjustmentNotes.length > 0,
                        adjustmentNotes: [...record.adjustmentNotes]
                    }
                    : person;
            });
            const rosterIds = new Set(roster.map((person) => person.employeeId));
            return {
                mode: "actual",
                people,
                periodDates,
                periodCount,
                scheduleReady: true,
                addedEmployeeIds: people.filter((person) => !actualById.has(person.employeeId)).map((person) => person.employeeId),
                removedPeople: actual.filter((record) => !rosterIds.has(record.employeeId)).map((record) => ({
                    employeeId: record.employeeId,
                    name: record.name,
                    department: record.department,
                    period: record.period
                }))
            };
        }

        if (previousState) {
            const previousById = new Map(previousState.people.map((person) => [person.employeeId, person]));
            const rosterIds = new Set(roster.map((person) => person.employeeId));
            const people = roster.map((person) => {
                const previous = previousById.get(person.employeeId);
                return previous
                    ? {
                        ...person,
                        period: previous.period,
                        adjusted: previous.adjusted,
                        adjustmentNotes: [...previous.adjustmentNotes]
                    }
                    : person;
            });
            return {
                mode: "reimport",
                people,
                periodDates: { ...previousState.periodDates },
                periodCount: previousState.periodCount,
                scheduleReady: previousState.scheduleReady,
                addedEmployeeIds: people.filter((person) => !previousById.has(person.employeeId)).map((person) => person.employeeId),
                removedPeople: previousState.people.filter((person) => !rosterIds.has(person.employeeId)).map((person) => ({
                    employeeId: person.employeeId,
                    name: person.name,
                    department: person.department,
                    period: person.period
                }))
            };
        }

        const periodCount = validatePeriodCount(requestedPeriodCount);
        return {
            mode: "pending",
            people: roster,
            periodDates: emptyPeriodDates(periodCount),
            periodCount,
            scheduleReady: false,
            addedEmployeeIds: [],
            removedPeople: []
        };
    }

    function formatPeriod(period: number | null): string {
        return period === null ? "待分配" : `第${period}期`;
    }

    function categoryLabel(category: SeasonalLearningCategory): string {
        if (category === "leader") return "带队机长";
        if (category === "captain") return "机长";
        return "副驾驶";
    }

    window.SeasonalLearningData = {
        parseBusinessDate,
        normalizeEmployeeId,
        readRosterRows,
        buildImportResult,
        formatPeriod,
        categoryLabel
    };
})();
