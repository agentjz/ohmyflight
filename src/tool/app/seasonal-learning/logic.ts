(function () {
    const Data = window.SeasonalLearningData;
    const CATEGORY_ORDER: SeasonalLearningCategory[] = ["leader", "captain", "firstOfficer"];

    function clonePerson(person: SeasonalLearningPerson): SeasonalLearningPerson {
        return { ...person, adjustmentNotes: [...person.adjustmentNotes] };
    }

    function validatePeriodCount(periodCount: number): void {
        if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 30) {
            throw new Error("期数必须是 1 到 30 的整数。");
        }
    }

    function buildCategoryQuotas(people: SeasonalLearningPerson[], periodCount: number): Record<SeasonalLearningCategory, number[]> {
        const quotas = {} as Record<SeasonalLearningCategory, number[]>;
        const totals = Array(periodCount).fill(0) as number[];

        CATEGORY_ORDER.forEach((category) => {
            const categoryCount = people.filter((person) => person.category === category).length;
            const base = Math.floor(categoryCount / periodCount);
            const remainder = categoryCount % periodCount;
            const counts = Array(periodCount).fill(base) as number[];
            totals.forEach((_, index) => { totals[index] += base; });

            const recipients = Array.from({ length: periodCount }, (_, index) => index)
                .sort((left, right) => totals[left] - totals[right] || left - right)
                .slice(0, remainder);
            recipients.forEach((index) => {
                counts[index] += 1;
                totals[index] += 1;
            });
            quotas[category] = counts;
        });

        return quotas;
    }

    function buildInitialSchedule(people: SeasonalLearningPerson[], periodCount: number): SeasonalLearningPerson[] {
        validatePeriodCount(periodCount);
        const output = people.map(clonePerson);
        const quotas = buildCategoryQuotas(output, periodCount);

        CATEGORY_ORDER.forEach((category) => {
            const group = output
                .filter((person) => person.category === category)
                .sort((left, right) => left.originalOrder - right.originalOrder);
            let cursor = 0;
            quotas[category].forEach((count, periodIndex) => {
                for (let offset = 0; offset < count; offset += 1) {
                    group[cursor].period = periodIndex + 1;
                    group[cursor].adjusted = false;
                    group[cursor].adjustmentNotes = [];
                    cursor += 1;
                }
            });
        });
        return output;
    }

    function dimensionReport(counts: number[], expectedTotal: number, tolerance: number): SeasonalLearningDimensionReport {
        const minimum = Math.min(...counts);
        const maximum = Math.max(...counts);
        const complete = counts.reduce((sum, count) => sum + count, 0) === expectedTotal;
        const balanced = complete && maximum - minimum <= tolerance;
        return {
            counts,
            minimum,
            maximum,
            balanced,
            outlierPeriods: !complete || balanced
                ? []
                : counts
                    .map((count, index) => count === minimum || count === maximum ? index + 1 : 0)
                    .filter(Boolean)
        };
    }

    function checkBalance(people: SeasonalLearningPerson[], periodCount: number): SeasonalLearningBalanceReport {
        validatePeriodCount(periodCount);
        const assigned = people.filter((person) => person.period !== null);
        const pendingCount = people.length - assigned.length;
        const totalCounts = Array(periodCount).fill(0) as number[];
        const categoryCounts: Record<SeasonalLearningCategory, number[]> = {
            leader: Array(periodCount).fill(0),
            captain: Array(periodCount).fill(0),
            firstOfficer: Array(periodCount).fill(0)
        };

        assigned.forEach((person) => {
            if (!person.period || person.period > periodCount) return;
            totalCounts[person.period - 1] += 1;
            categoryCounts[person.category][person.period - 1] += 1;
        });

        const dimensions = {
            total: dimensionReport(totalCounts, people.length, 5),
            leader: dimensionReport(categoryCounts.leader, people.filter((person) => person.category === "leader").length, 1),
            captain: dimensionReport(categoryCounts.captain, people.filter((person) => person.category === "captain").length, 1),
            firstOfficer: dimensionReport(categoryCounts.firstOfficer, people.filter((person) => person.category === "firstOfficer").length, 1)
        };
        return {
            balanced: pendingCount === 0 && Object.values(dimensions).every((dimension) => dimension.balanced),
            pendingCount,
            dimensions
        };
    }

    function buildPeriodSummaries(
        people: SeasonalLearningPerson[],
        periodDates: Record<number, string>,
        periodCount: number
    ): SeasonalLearningPeriodSummary[] {
        const report = checkBalance(people, periodCount);
        const labels: Array<[keyof SeasonalLearningBalanceReport["dimensions"], string]> = [
            ["total", "总人数"],
            ["leader", "带队机长"],
            ["captain", "机长"],
            ["firstOfficer", "副驾驶"]
        ];
        return Array.from({ length: periodCount }, (_, index) => {
            const period = index + 1;
            const issues = labels
                .filter(([key]) => report.dimensions[key].outlierPeriods.includes(period))
                .map(([, label]) => label);
            return {
                period,
                date: periodDates[period] || "",
                total: report.dimensions.total.counts[index],
                leader: report.dimensions.leader.counts[index],
                captain: report.dimensions.captain.counts[index],
                firstOfficer: report.dimensions.firstOfficer.counts[index],
                issues
            };
        });
    }

    function uniqueIds(employeeIds: string[]): string[] {
        return [...new Set(employeeIds.map(Data.normalizeEmployeeId).filter(Boolean))];
    }

    function movePeople(
        people: SeasonalLearningPerson[],
        employeeIds: string[],
        targetPeriod: number,
        periodCount: number
    ): SeasonalLearningOperationResult {
        validatePeriodCount(periodCount);
        if (!Number.isInteger(targetPeriod) || targetPeriod < 1 || targetPeriod > periodCount) {
            throw new Error("请选择有效的目标期次。");
        }
        const ids = uniqueIds(employeeIds);
        if (!ids.length) throw new Error("请至少选择一人。");
        const knownIds = new Set(people.map((person) => person.employeeId));
        const missing = ids.filter((id) => !knownIds.has(id));
        if (missing.length) throw new Error(`未找到员工号：${missing.join("、")}。`);

        const selected = new Set(ids);
        const events: SeasonalLearningAdjustmentEvent[] = [];
        const output = people.map((person) => {
            if (!selected.has(person.employeeId) || person.period === targetPeriod) return clonePerson(person);
            const from = Data.formatPeriod(person.period);
            const to = Data.formatPeriod(targetPeriod);
            const note = `移动：${from} → ${to}`;
            events.push({ employeeId: person.employeeId, name: person.name, type: "move", text: `${person.name}：${note}` });
            return {
                ...person,
                period: targetPeriod,
                adjusted: true,
                adjustmentNotes: [...person.adjustmentNotes, note]
            };
        });
        if (!events.length) throw new Error("所选人员已经在目标期次。");
        return { people: output, events };
    }

    function swapGroups(
        people: SeasonalLearningPerson[],
        leftEmployeeIds: string[],
        rightEmployeeIds: string[]
    ): SeasonalLearningOperationResult {
        const leftIds = uniqueIds(leftEmployeeIds);
        const rightIds = uniqueIds(rightEmployeeIds);
        if (!leftIds.length || !rightIds.length) throw new Error("请先设置两个交换组。");
        if (leftIds.length !== rightIds.length) throw new Error("两个交换组的人数必须相同。");
        if (leftIds.some((id) => rightIds.includes(id))) throw new Error("同一人员不能同时出现在两个交换组。");

        const peopleById = new Map(people.map((person) => [person.employeeId, person]));
        const leftPeople = leftIds.map((id) => peopleById.get(id));
        const rightPeople = rightIds.map((id) => peopleById.get(id));
        if (leftPeople.some((person) => !person) || rightPeople.some((person) => !person)) {
            throw new Error("交换组中存在已不在当前名单的人员。");
        }
        const leftPeriods = new Set(leftPeople.map((person) => person?.period));
        const rightPeriods = new Set(rightPeople.map((person) => person?.period));
        if (leftPeriods.size !== 1 || rightPeriods.size !== 1 || leftPeriods.has(null) || rightPeriods.has(null)) {
            throw new Error("每个交换组的人员必须来自同一期次。");
        }
        const leftPeriod = leftPeople[0]?.period as number;
        const rightPeriod = rightPeople[0]?.period as number;
        if (leftPeriod === rightPeriod) throw new Error("两个交换组必须来自不同期次。");

        const leftSet = new Set(leftIds);
        const rightSet = new Set(rightIds);
        const events: SeasonalLearningAdjustmentEvent[] = [];
        const output = people.map((person) => {
            if (!leftSet.has(person.employeeId) && !rightSet.has(person.employeeId)) return clonePerson(person);
            const target = leftSet.has(person.employeeId) ? rightPeriod : leftPeriod;
            const note = `交换：${Data.formatPeriod(person.period)} ↔ ${Data.formatPeriod(target)}`;
            events.push({ employeeId: person.employeeId, name: person.name, type: "swap", text: `${person.name}：${note}` });
            return {
                ...person,
                period: target,
                adjusted: true,
                adjustmentNotes: [...person.adjustmentNotes, note]
            };
        });
        return { people: output, events };
    }

    window.SeasonalLearningLogic = {
        ...Data,
        buildInitialSchedule,
        checkBalance,
        buildPeriodSummaries,
        movePeople,
        swapGroups
    };
})();
