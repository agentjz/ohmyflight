(function () {
    const Data = window.SeasonalLearningData;
    const Allocation = window.SeasonalLearningAllocation;
    const BalanceFilter = window.SeasonalLearningBalanceFilter;
    const BalanceRules = window.SeasonalLearningBalanceRules;

    interface ResolvedPeopleGroup {
        definition: SeasonalLearningBalanceGroupDefinition;
        people: SeasonalLearningPerson[];
        firstOrder: number;
    }

    function clonePerson(person: SeasonalLearningPerson): SeasonalLearningPerson {
        return { ...person, adjustmentNotes: [...person.adjustmentNotes] };
    }

    function validatePeriodCount(periodCount: number): void {
        if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 30) {
            throw new Error("期数必须是 1 到 30 的整数。");
        }
    }

    function resolvePeopleGroups(
        people: SeasonalLearningPerson[],
        enabledHookIds: readonly string[]
    ): { groups: ResolvedPeopleGroup[]; neutralPeople: SeasonalLearningPerson[] } {
        const grouped = new Map<string, ResolvedPeopleGroup>();
        const neutralPeople: SeasonalLearningPerson[] = [];
        people
            .slice()
            .sort((left, right) => left.originalOrder - right.originalOrder)
            .forEach((person) => {
                const definition = BalanceRules.resolveBalanceGroup(person, enabledHookIds);
                if (!definition) {
                    neutralPeople.push(person);
                    return;
                }
                const current = grouped.get(definition.id);
                if (current) {
                    current.people.push(person);
                    return;
                }
                grouped.set(definition.id, {
                    definition,
                    people: [person],
                    firstOrder: person.originalOrder
                });
            });
        const groups = [...grouped.values()].sort((left, right) => (
            right.definition.priority - left.definition.priority
            || left.definition.label.localeCompare(right.definition.label, "zh-CN")
            || left.firstOrder - right.firstOrder
        ));
        return { groups, neutralPeople };
    }

    function assignPeople(people: SeasonalLearningPerson[], counts: number[]): void {
        let cursor = 0;
        counts.forEach((count, periodIndex) => {
            for (let offset = 0; offset < count; offset += 1) {
                const person = people[cursor];
                if (!person) throw new Error("均衡组人员配额未闭合。");
                person.period = periodIndex + 1;
                person.adjusted = false;
                person.adjustmentNotes = [];
                cursor += 1;
            }
        });
        if (cursor !== people.length) throw new Error("均衡组人员配额未闭合。");
    }

    function buildInitialSchedule(
        people: SeasonalLearningPerson[],
        periodCount: number,
        enabledHookIds: readonly string[] = BalanceRules.DEFAULT_ENABLED_HOOK_IDS
    ): SeasonalLearningPerson[] {
        validatePeriodCount(periodCount);
        const normalizedHookIds = BalanceRules.normalizeEnabledHookIds(enabledHookIds);
        const output = people.map(clonePerson);
        const resolved = resolvePeopleGroups(output, normalizedHookIds);
        const quotas = Allocation.buildDynamicQuotas(
            resolved.groups.map((group) => ({ id: group.definition.id, count: group.people.length })),
            resolved.neutralPeople.length,
            periodCount
        );

        resolved.groups.forEach((group) => {
            assignPeople(group.people, quotas.groupCounts[group.definition.id]);
        });
        assignPeople(resolved.neutralPeople, quotas.neutralCounts);
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

    function checkBalance(
        people: SeasonalLearningPerson[],
        periodCount: number,
        enabledHookIds: readonly string[] = BalanceRules.DEFAULT_ENABLED_HOOK_IDS
    ): SeasonalLearningBalanceReport {
        validatePeriodCount(periodCount);
        const normalizedHookIds = BalanceRules.normalizeEnabledHookIds(enabledHookIds);
        const assigned = people.filter((person) => person.period !== null);
        const pendingCount = people.length - assigned.length;
        const resolved = resolvePeopleGroups(people, normalizedHookIds);
        const operationalPendingCount = resolved.groups.reduce(
            (sum, group) => sum + group.people.filter((person) => person.period === null).length,
            0
        );
        const totalCounts = Array(periodCount).fill(0) as number[];
        assigned.forEach((person) => {
            if (person.period && person.period <= periodCount) totalCounts[person.period - 1] += 1;
        });
        const total = dimensionReport(totalCounts, assigned.length, 5);
        const groups = resolved.groups.map((group) => {
            const counts = Array(periodCount).fill(0) as number[];
            group.people.forEach((person) => {
                if (person.period && person.period <= periodCount) counts[person.period - 1] += 1;
            });
            return {
                ...group.definition,
                memberCount: group.people.length,
                ...dimensionReport(counts, group.people.length, 1)
            };
        });
        return {
            balanced: operationalPendingCount === 0 && total.balanced && groups.every((group) => group.balanced),
            pendingCount,
            operationalPendingCount,
            total,
            groups
        };
    }

    function buildPeriodSummaries(
        people: SeasonalLearningPerson[],
        periodDates: Record<number, string>,
        periodCount: number,
        enabledHookIds: readonly string[] = BalanceRules.DEFAULT_ENABLED_HOOK_IDS
    ): SeasonalLearningPeriodSummary[] {
        const report = checkBalance(people, periodCount, enabledHookIds);
        return Array.from({ length: periodCount }, (_, index) => {
            const period = index + 1;
            const periodPeople = people.filter((person) => person.period === period);
            const operationalPeople = periodPeople.filter((person) => !BalanceFilter.shouldIgnoreOperational(person));
            const issues = [
                ...(report.total.outlierPeriods.includes(period) ? ["总人数"] : []),
                ...report.groups
                    .filter((group) => group.outlierPeriods.includes(period))
                    .map((group) => group.label)
            ];
            return {
                period,
                date: periodDates[period] || "",
                total: periodPeople.length,
                leader: operationalPeople.filter((person) => person.category === "leader").length,
                captain: operationalPeople.filter((person) => person.category === "captain").length,
                firstOfficer: operationalPeople.filter((person) => person.category === "firstOfficer").length,
                usLineLeader: operationalPeople.filter((person) => person.isUsLineLeader).length,
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
