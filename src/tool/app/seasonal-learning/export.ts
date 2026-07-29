(function () {
    const ACTUAL_SHEET = "换季实际";
    const TOTAL_SHEET = "换季总名单";
    const HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "培训类型", "日期", "期数", "调整说明"];
    const DATE_FORMAT = "yyyy-mm-dd";

    function cloneValue<T>(value: T): T {
        if (value === undefined || value === null) return value;
        if (typeof structuredClone === "function") {
            try {
                return structuredClone(value);
            } catch {
                return JSON.parse(JSON.stringify(value)) as T;
            }
        }
        return JSON.parse(JSON.stringify(value)) as T;
    }

    function cloneWorkbook(source: import("xlsx-js-style").WorkBook): import("xlsx-js-style").WorkBook {
        return {
            ...source,
            SheetNames: [...source.SheetNames],
            Sheets: { ...source.Sheets }
        };
    }

    function cloneSheetMeta(sheet: import("xlsx-js-style").WorkSheet): import("xlsx-js-style").WorkSheet {
        const result: import("xlsx-js-style").WorkSheet = {};
        Object.keys(sheet).filter((key) => key.startsWith("!")).forEach((key) => {
            result[key] = cloneValue(sheet[key]);
        });
        return result;
    }

    function businessDate(dateKey: string): Date | null {
        const matched = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!matched) return null;
        return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]), 12, 0, 0, 0);
    }

    function sourceStyle(
        actualSheet: import("xlsx-js-style").WorkSheet,
        totalSheet: import("xlsx-js-style").WorkSheet,
        person: SeasonalLearningPerson | null,
        columnIndex: number
    ): Record<string, unknown> {
        const sourceColumn = Math.min(columnIndex, 8);
        const actualAddress = window.XLSX.utils.encode_cell({ r: person ? 1 : 0, c: sourceColumn });
        const totalAddress = window.XLSX.utils.encode_cell({ r: person ? person.sourceRow - 1 : 0, c: sourceColumn });
        const actualCell = actualSheet[actualAddress] as { s?: Record<string, unknown> } | undefined;
        const totalCell = totalSheet[totalAddress] as { s?: Record<string, unknown> } | undefined;
        return cloneValue(actualCell?.s || totalCell?.s || {});
    }

    function adjustedStyle(base: Record<string, unknown>): Record<string, unknown> {
        const font = (base.font && typeof base.font === "object")
            ? cloneValue(base.font as Record<string, unknown>)
            : {};
        return {
            ...base,
            fill: {
                patternType: "solid",
                fgColor: { rgb: "FFF2F2" }
            },
            font: {
                ...font,
                color: { rgb: "000000" }
            }
        };
    }

    function writeCell(
        sheet: import("xlsx-js-style").WorkSheet,
        rowIndex: number,
        columnIndex: number,
        value: unknown,
        style: Record<string, unknown>,
        type?: "s" | "n" | "d"
    ): void {
        const address = window.XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const resolvedType = type || (typeof value === "number" ? "n" : value instanceof Date ? "d" : "s");
        const cell: Record<string, unknown> = { v: value ?? "", t: resolvedType, s: style };
        if (resolvedType === "d") cell.z = DATE_FORMAT;
        sheet[address] = cell;
    }

    function sortedPeople(people: SeasonalLearningPerson[], periodDates: Record<number, string>): SeasonalLearningPerson[] {
        return [...people].sort((left, right) => {
            const leftPeriod = left.period ?? Number.MAX_SAFE_INTEGER;
            const rightPeriod = right.period ?? Number.MAX_SAFE_INTEGER;
            return leftPeriod - rightPeriod
                || (periodDates[leftPeriod] || "").localeCompare(periodDates[rightPeriod] || "")
                || left.originalOrder - right.originalOrder;
        });
    }

    function buildExportWorkbook(
        sourceWorkbook: import("xlsx-js-style").WorkBook,
        people: SeasonalLearningPerson[],
        periodDates: Record<number, string>
    ): import("xlsx-js-style").WorkBook {
        const sourceActual = sourceWorkbook.Sheets[ACTUAL_SHEET];
        const sourceTotal = sourceWorkbook.Sheets[TOTAL_SHEET];
        if (!sourceActual) throw new Error(`未找到工作表：${ACTUAL_SHEET}。`);
        if (!sourceTotal) throw new Error(`未找到工作表：${TOTAL_SHEET}。`);

        const output = cloneWorkbook(sourceWorkbook);
        const actual = cloneSheetMeta(sourceActual);
        HEADERS.forEach((header, columnIndex) => {
            writeCell(actual, 0, columnIndex, header, sourceStyle(sourceActual, sourceTotal, null, columnIndex), "s");
        });

        sortedPeople(people, periodDates).forEach((person, index) => {
            const rowIndex = index + 1;
            const date = person.period === null ? null : businessDate(periodDates[person.period] || "");
            const values: unknown[] = [
                person.sequence,
                person.employeeId,
                person.name,
                person.department,
                person.technicalInfo,
                person.isLeader ? 1 : 0,
                person.trainingType,
                date || "",
                person.period ?? "",
                person.adjustmentNotes.join("；")
            ];

            values.forEach((value, columnIndex) => {
                const base = sourceStyle(sourceActual, sourceTotal, person, columnIndex);
                const style = person.adjusted ? adjustedStyle(base) : base;
                const type = columnIndex === 7 && date
                    ? "d"
                    : columnIndex === 0 && typeof value === "number" || columnIndex === 5 || columnIndex === 8 && typeof value === "number"
                        ? "n"
                        : "s";
                writeCell(actual, rowIndex, columnIndex, value, style, type);
            });
        });

        actual["!ref"] = window.XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: Math.max(0, people.length), c: HEADERS.length - 1 }
        });
        const existingColumns = cloneValue(
            sourceActual["!cols"] || sourceTotal["!cols"] || []
        ) as NonNullable<import("xlsx-js-style").WorkSheet["!cols"]>;
        while (existingColumns.length < HEADERS.length - 1) existingColumns.push({ wch: 14 });
        existingColumns[HEADERS.length - 1] = { wch: 36 };
        actual["!cols"] = existingColumns;
        actual["!autofilter"] = { ref: actual["!ref"] };
        output.Sheets[ACTUAL_SHEET] = actual;
        return output;
    }

    function buildOutputFileName(sourceFileName: string): string {
        const base = String(sourceFileName || "换季学习").replace(/\.[^.]+$/, "");
        return `${base}_换季实际.xlsx`;
    }

    window.SeasonalLearningExport = {
        buildExportWorkbook,
        buildOutputFileName
    };
})();
