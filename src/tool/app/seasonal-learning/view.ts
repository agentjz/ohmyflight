(function () {
    const namespace = window.SeasonalLearningApp;
    const categoryKeys: SeasonalLearningCategory[] = ["leader", "captain", "firstOfficer"];

    function peopleByCategory(people: SeasonalLearningPerson[], category: SeasonalLearningCategory): SeasonalLearningPerson[] {
        return people
            .filter((person) => person.category === category)
            .sort((left, right) => left.originalOrder - right.originalOrder);
    }

    function renderPerson(context: SeasonalLearningAppContext, person: SeasonalLearningPerson): string {
        const category = context.logic.categoryLabel(person.category);
        return `
            <label class="person-choice category-${person.category}">
                <input class="form-check-input person-checkbox" type="checkbox" value="${context.escapeHtml(person.employeeId)}">
                <span class="person-copy">
                    <strong>${context.escapeHtml(person.name)}</strong>
                    <small>${context.escapeHtml(category)}</small>
                </span>
            </label>
        `;
    }

    function renderGroup(
        context: SeasonalLearningAppContext,
        people: SeasonalLearningPerson[],
        category: SeasonalLearningCategory
    ): string {
        const group = peopleByCategory(people, category);
        const label = context.logic.categoryLabel(category);
        return `
            <section class="roster-group category-${category}">
                <div class="group-heading">
                    <h4>${context.escapeHtml(label)}</h4>
                    <span>${group.length}</span>
                </div>
                <div class="people-grid">
                    ${group.length ? group.map((person) => renderPerson(context, person)).join("") : '<span class="empty-group">本期无人</span>'}
                </div>
            </section>
        `;
    }

    function renderDateControls(context: SeasonalLearningAppContext): void {
        const container = context.getElement<HTMLDivElement>("dateControls");
        container.innerHTML = Array.from({ length: context.state.periodCount }, (_, index) => {
            const period = index + 1;
            return `
                <label class="date-field">
                    <span>第${period}期</span>
                    <input class="form-control form-control-sm period-date" type="date" data-period="${period}" value="${context.escapeHtml(context.state.periodDates[period] || "")}">
                </label>
            `;
        }).join("");
    }

    function renderSummary(context: SeasonalLearningAppContext): void {
        const people = context.state.people;
        const report = context.logic.checkBalance(people, context.state.periodCount);
        const summary = [
            ["总人数", people.length],
            ["带队机长", people.filter((person) => person.category === "leader").length],
            ["机长", people.filter((person) => person.category === "captain").length],
            ["副驾驶", people.filter((person) => person.category === "firstOfficer").length],
            ["待分配", report.pendingCount],
            ["人工调整", people.filter((person) => person.adjusted).length]
        ];
        context.getElement<HTMLDivElement>("summaryStrip").innerHTML = summary.map(([label, value]) => `
            <div class="summary-item">
                <span>${context.escapeHtml(label)}</span>
                <strong>${context.escapeHtml(value)}</strong>
            </div>
        `).join("");
    }

    function renderChart(context: SeasonalLearningAppContext): void {
        const element = context.getElement<HTMLDivElement>("distributionChart");
        if (!window.echarts) {
            element.textContent = "图表组件未加载。";
            return;
        }
        const summaries = context.logic.buildPeriodSummaries(
            context.state.people,
            context.state.periodDates,
            context.state.periodCount
        );
        context.state.chart = context.state.chart || window.echarts.init(element);
        const textColor = getComputedStyle(document.documentElement).getPropertyValue("--omf-text").trim() || "#1f2328";
        const mutedColor = getComputedStyle(document.documentElement).getPropertyValue("--omf-text-muted").trim() || "#656d76";
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue("--omf-border").trim() || "#d0d7de";
        context.state.chart.setOption({
            animationDuration: 280,
            color: ["#2563eb", "#0f766e", "#b45309", "#c026d3"],
            tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
            legend: { top: 0, textStyle: { color: textColor } },
            grid: { top: 46, left: 46, right: 34, bottom: 38 },
            xAxis: {
                type: "category",
                data: summaries.map((summary) => `第${summary.period}期`),
                axisLine: { lineStyle: { color: borderColor } },
                axisLabel: { color: mutedColor }
            },
            yAxis: {
                type: "value",
                minInterval: 1,
                axisLabel: { color: mutedColor },
                splitLine: { lineStyle: { color: borderColor, opacity: 0.55 } }
            },
            series: [
                { name: "带队机长", type: "bar", stack: "people", data: summaries.map((item) => item.leader), barMaxWidth: 54 },
                { name: "机长", type: "bar", stack: "people", data: summaries.map((item) => item.captain), barMaxWidth: 54 },
                { name: "副驾驶", type: "bar", stack: "people", data: summaries.map((item) => item.firstOfficer), barMaxWidth: 54 },
                { name: "总人数", type: "line", data: summaries.map((item) => item.total), symbolSize: 7, lineStyle: { width: 2 } }
            ]
        }, true);
        context.state.chart.resize();
    }

    function renderPending(context: SeasonalLearningAppContext): void {
        const pending = context.state.people.filter((person) => person.period === null);
        const section = context.getElement<HTMLElement>("pendingSection");
        section.hidden = pending.length === 0;
        if (!pending.length) return;
        context.getElement<HTMLSpanElement>("pendingCount").textContent = String(pending.length);
        context.getElement<HTMLDivElement>("pendingPeople").innerHTML = pending.map((person) => renderPerson(context, person)).join("");
    }

    function renderPeriodCards(context: SeasonalLearningAppContext): void {
        const summaries = context.logic.buildPeriodSummaries(
            context.state.people,
            context.state.periodDates,
            context.state.periodCount
        );
        context.getElement<HTMLDivElement>("periodCards").innerHTML = summaries.map((summary) => {
            const people = context.state.people.filter((person) => person.period === summary.period);
            const status = summary.issues.length ? `需检查：${summary.issues.join("、")}` : "均衡";
            return `
                <article class="period-card ${summary.issues.length ? "has-issue" : ""}">
                    <header class="period-card-header">
                        <div class="period-title">
                            <h3>第${summary.period}期</h3>
                            <span>${context.escapeHtml(summary.date || "日期未填写")}</span>
                        </div>
                        <div class="period-counts">
                            <span><b>${summary.total}</b> 总人数</span>
                            <span class="count-leader"><b>${summary.leader}</b> 带队机长</span>
                            <span class="count-captain"><b>${summary.captain}</b> 机长</span>
                            <span class="count-first-officer"><b>${summary.firstOfficer}</b> 副驾驶</span>
                        </div>
                        <span class="period-status">${context.escapeHtml(status)}</span>
                    </header>
                    <div class="roster-columns">
                        ${categoryKeys.map((category) => renderGroup(context, people, category)).join("")}
                    </div>
                </article>
            `;
        }).join("");
    }

    function renderChanges(context: SeasonalLearningAppContext): void {
        const added = new Set(context.state.addedEmployeeIds);
        const addedPeople = context.state.people.filter((person) => added.has(person.employeeId));
        const section = context.getElement<HTMLElement>("changeSection");
        section.hidden = addedPeople.length === 0 && context.state.removedPeople.length === 0;
        if (section.hidden) return;
        context.getElement<HTMLDivElement>("changeContent").innerHTML = `
            ${addedPeople.length ? `<div><strong>新增 ${addedPeople.length} 人</strong><span>${addedPeople.map((person) => context.escapeHtml(person.name)).join("、")}</span></div>` : ""}
            ${context.state.removedPeople.length ? `<div><strong>删除 ${context.state.removedPeople.length} 人</strong><span>${context.state.removedPeople.map((person) => context.escapeHtml(person.name || person.employeeId)).join("、")}</span></div>` : ""}
        `;
    }

    function renderLog(context: SeasonalLearningAppContext): void {
        const list = context.getElement<HTMLDivElement>("adjustmentLog");
        list.innerHTML = context.state.adjustmentLog.length
            ? context.state.adjustmentLog.map((entry) => `<div>${context.escapeHtml(entry)}</div>`).join("")
            : '<span class="empty-log">暂无人工调整</span>';
    }

    function exchangeGroupDetails(context: SeasonalLearningAppContext, employeeIds: string[]): {
        people: SeasonalLearningPerson[];
        period: number | null;
    } {
        const peopleById = new Map(context.state.people.map((person) => [person.employeeId, person]));
        const people = employeeIds.flatMap((employeeId) => {
            const person = peopleById.get(employeeId);
            return person ? [person] : [];
        });
        const periods = new Set(people.map((person) => person.period));
        return { people, period: periods.size === 1 ? people[0]?.period ?? null : null };
    }

    function renderExchangeGroup(
        context: SeasonalLearningAppContext,
        elementId: string,
        employeeIds: string[]
    ): { count: number; period: number | null } {
        const details = exchangeGroupDetails(context, employeeIds);
        context.getElement<HTMLDivElement>(elementId).innerHTML = details.people.length
            ? `
                <div class="exchange-group-meta">${context.escapeHtml(context.logic.formatPeriod(details.period))} · ${details.people.length} 人</div>
                <div class="exchange-name-list">${details.people.map((person) => `<span>${context.escapeHtml(person.name)}</span>`).join("")}</div>
            `
            : '<span class="empty-log">尚未加入人员</span>';
        return { count: details.people.length, period: details.period };
    }

    function renderExchangeTray(context: SeasonalLearningAppContext): void {
        const groupA = renderExchangeGroup(context, "exchangeGroupAContent", context.state.exchangeGroupA);
        const groupB = renderExchangeGroup(context, "exchangeGroupBContent", context.state.exchangeGroupB);
        const ready = groupA.count > 0
            && groupA.count === groupB.count
            && groupA.period !== null
            && groupB.period !== null
            && groupA.period !== groupB.period;
        const status = !groupA.count || !groupB.count
            ? "请分别设置两个交换组"
            : groupA.count !== groupB.count
                ? `人数不一致：A 组 ${groupA.count} 人，B 组 ${groupB.count} 人`
                : groupA.period === groupB.period
                    ? "两个交换组必须来自不同期次"
                    : `可交换：${groupA.count} 人 ↔ ${groupB.count} 人`;
        context.getElement<HTMLSpanElement>("exchangeStatus").textContent = status;
        context.getElement<HTMLButtonElement>("executeSwapButton").disabled = !context.state.scheduleReady || !ready;
        context.getElement<HTMLButtonElement>("clearExchangeAButton").disabled = groupA.count === 0;
        context.getElement<HTMLButtonElement>("clearExchangeBButton").disabled = groupB.count === 0;
    }

    function renderSelectionCount(context: SeasonalLearningAppContext): void {
        const count = document.querySelectorAll<HTMLInputElement>(".person-checkbox:checked").length;
        context.getElement<HTMLSpanElement>("selectionCount").textContent = String(count);
    }

    function renderAll(context: SeasonalLearningAppContext): void {
        const workspace = context.getElement<HTMLElement>("workspace");
        workspace.hidden = !context.state.initialized;
        context.getElement<HTMLButtonElement>("exportButton").disabled = !context.state.initialized;
        const balanceButton = context.getElement<HTMLButtonElement>("balanceButton");
        balanceButton.disabled = !context.state.initialized;
        balanceButton.textContent = context.state.scheduleReady ? "均衡检查" : "均衡负载";
        context.getElement<HTMLInputElement>("periodCount").disabled = context.state.scheduleReady;
        context.getElement<HTMLButtonElement>("moveButton").disabled = !context.state.scheduleReady;
        context.getElement<HTMLButtonElement>("addExchangeAButton").disabled = !context.state.scheduleReady;
        context.getElement<HTMLButtonElement>("addExchangeBButton").disabled = !context.state.scheduleReady;
        if (!context.state.initialized) {
            renderDateControls(context);
            return;
        }
        renderDateControls(context);
        renderSummary(context);
        renderChart(context);
        renderPending(context);
        renderPeriodCards(context);
        renderChanges(context);
        renderLog(context);
        renderExchangeTray(context);
        renderSelectionCount(context);
    }

    namespace.View = {
        renderAll,
        renderDateControls,
        renderChart,
        renderSelectionCount,
        renderExchangeTray
    };
})();
