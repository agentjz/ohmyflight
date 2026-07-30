(function () {
    const Data = window.SeasonalLearningData;
    const Allocation = window.SeasonalLearningAllocation;
    const CATEGORY_ORDER: SeasonalLearningCategory[] = ["leader", "captain", "firstOfficer"];

    function clonePerson(person: SeasonalLearningPerson): SeasonalLearningPerson {
        return { ...person, adjustmentNotes: [...person.adjustmentNotes] };
    }

    function validatePeriodCount(periodCount: number): void {
        if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 30) {
            throw new Error("期数必须是 1 到 30 的整数。");
        }
    }

    function assignPeople(
        people: SeasonalLearningPerson[],
        counts: number[],
        marked: boolean
    ): void {
        let cursor = 0;
        counts.forEach((count, periodIndex) => {
            for (let offset = 0; offset < count; offset += 1) {
                const person = people[cursor];
                person.period = periodIndex + 1;
                person.adjusted = false;
                person.adjustmentNotes = [];
                cursor += 1;
            }
        });
        if (cursor !== people.length) {
            throw new Error(marked ? "美线带队人员配额未闭合。" : "普通人员配额未闭合。");
        }
    }

    function buildInitialSchedule(people: SeasonalLearningPerson[], periodCount: number): SeasonalLearningPerson[] {
        validatePeriodCount(periodCount);
        const output = people.map(clonePerson);
        const quotas = Allocation.buildBalancedQuotas(output, periodCount);

        CATEGORY_ORDER.forEach((category) => {
            const group = output
                .filter((person) => person.category === category)
                .sort((left, right) => left.originalOrder - right.originalOrder);
            const marked = group.filter((person) => person.isUsLineLeader);
            const unmarked = group.filter((person) => !person.isUsLineLeader);
            assignPeople(marked, quotas.usLineLeader[category], true);
            assignPeople(
                unmarked,
                quotas.category[category].map((count, index) => count - quotas.usLineLeader[category][index]),
                false
            );
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
        const usLineLeaderCounts = Array(periodCount).fill(0) as number[];

        assigned.forEach((person) => {
            if (!person.period || person.period > periodCount) return;
            totalCounts[person.period - 1] += 1;
            categoryCounts[person.category][person.period - 1] += 1;
            if (person.isUsLineLeader) usLineLeaderCounts[person.period - 1] += 1;
        });

        const dimensions = {
            total: dimensionReport(totalCounts, people.length, 5),
            leader: dimensionReport(categoryCounts.leader, people.filter((person) => person.category === "leader").length, 1),
            captain: dimensionReport(categoryCounts.captain, people.filter((person) => person.category === "captain").length, 1),
            firstOfficer: dimensionReport(categoryCounts.firstOfficer, people.filter((person) => person.category === "firstOfficer").length, 1),
            usLineLeader: dimensionReport(usLineLeaderCounts, people.filter((person) => person.isUsLineLeader).length, 1)
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
            ["firstOfficer", "副驾驶"],
            ["usLineLeader", "美线带队"]
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
                usLineLeader: report.dimensions.usLineLeader.counts[index],
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

    window.SeasonalLearningLogic = {
        ...Data,
        buildInitialSchedule,
        checkBalance,
        buildPeriodSummaries,
        movePeople
    };
})();
