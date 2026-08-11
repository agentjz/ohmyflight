import { SeasonalLearningBalanceFilter as BalanceFilter } from "./balance-filter";
import type {
    SeasonalLearningAppContext,
    SeasonalLearningCategory,
    SeasonalLearningHealthPerson,
    SeasonalLearningPerson
} from "./models";

    const categoryKeys: SeasonalLearningCategory[] = ["leader", "captain", "firstOfficer"];

    function peopleByCategory(people: SeasonalLearningPerson[], category: SeasonalLearningCategory): SeasonalLearningPerson[] {
        return people
            .filter((person) => person.category === category)
            .sort((left, right) => left.originalOrder - right.originalOrder);
    }

    function identityHue(identity: string): number {
        let hash = 2166136261;
        for (const character of identity) {
            hash ^= character.codePointAt(0) || 0;
            hash = Math.imul(hash, 16777619);
        }
        return Math.abs(hash) % 360;
    }

    function renderIdentity(context: SeasonalLearningAppContext, identity: string): string {
        if (!identity) return "";
        return `<span class="identity-marker" style="--identity-hue:${identityHue(identity)}deg">${context.escapeHtml(identity)}</span>`;
    }

    function renderUsLineLeader(person: SeasonalLearningPerson): string {
        return person.isUsLineLeader ? '<span class="us-line-marker">美线带队</span>' : "";
    }

    function renderPerson(context: SeasonalLearningAppContext, person: SeasonalLearningPerson): string {
        const category = context.logic.categoryLabel(person.category);
        return `
            <label class="person-choice category-${person.category}">
                <input class="form-check-input person-checkbox" type="checkbox" value="${context.escapeHtml(person.employeeId)}">
                <span class="person-copy">
                    <span class="person-name-row">
                        <strong>${context.escapeHtml(person.name)}</strong>
                        ${renderIdentity(context, person.identity)}
                        ${renderUsLineLeader(person)}
                    </span>
                    <small class="person-category">${context.escapeHtml(category)}</small>
                    <small class="person-technical">${context.escapeHtml(person.technicalInfo)}</small>
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

    function renderBalanceRules(context: SeasonalLearningAppContext): void {
        const enabled = new Set(context.state.enabledBalanceHookIds);
        const disabled = context.state.scheduleReady ? "disabled" : "";
        const hookOptions = context.rules.HOOKS.map((hook, index) => `
            <label class="balance-rule-option">
                <input
                    class="form-check-input balance-hook-checkbox"
                    type="checkbox"
                    value="${context.escapeHtml(hook.id)}"
                    ${enabled.has(hook.id) ? "checked" : ""}
                    ${disabled}
                >
                <span class="balance-rule-order">${index + 1}</span>
                <span>${context.escapeHtml(hook.label)}</span>
            </label>
        `).join("");
        context.getElement<HTMLDivElement>("balanceRuleControls").innerHTML = `
            ${hookOptions}
            <label class="balance-rule-option is-fixed">
                <input class="form-check-input" type="checkbox" checked disabled>
                <span class="balance-rule-order">${context.rules.HOOKS.length + 1}</span>
                <span>技术等级</span>
            </label>
        `;
    }

    function balanceRow(
        context: SeasonalLearningAppContext,
        label: string,
        kindLabel: string,
        counts: number[],
        memberCount: number,
        balanced: boolean
    ): string {
        const assignedCount = counts.reduce((sum, count) => sum + count, 0);
        const pendingCount = memberCount - assignedCount;
        const minimum = Math.min(...counts);
        const maximum = Math.max(...counts);
        const status = pendingCount > 0 ? `待分配 ${pendingCount}` : balanced ? "均衡" : `相差 ${maximum - minimum}`;
        return `
            <div class="balance-result-row ${balanced && pendingCount === 0 ? "" : "needs-check"}">
                <div class="balance-result-name">
                    <strong>${context.escapeHtml(label)}</strong>
                    <span>${context.escapeHtml(kindLabel)} · ${memberCount} 人</span>
                </div>
                <div class="balance-period-counts">
                    ${counts.map((count, index) => `
                        <span><small>${index + 1}期</small><b>${count}</b></span>
                    `).join("")}
                </div>
                <span class="balance-result-state">${context.escapeHtml(status)}</span>
            </div>
        `;
    }

    function renderBalanceResults(context: SeasonalLearningAppContext): void {
        const report = context.logic.checkBalance(
            context.state.people,
            context.state.periodCount,
            context.state.enabledBalanceHookIds
        );
        const issueCount = report.groups.filter((group) => !group.balanced).length + (report.total.balanced ? 0 : 1);
        context.getElement<HTMLSpanElement>("balanceResultSummary").textContent = report.operationalPendingCount
            ? `${report.operationalPendingCount} 名运行人员待分配`
            : issueCount
                ? `${issueCount} 项需检查`
                : "全部在允许范围内";
        const rows = [
            balanceRow(
                context,
                "总人数",
                "总览",
                report.total.counts,
                context.state.people.length,
                report.total.balanced && report.pendingCount === 0
            ),
            ...report.groups.map((group) => balanceRow(
                context,
                group.label,
                group.kind === "hook" ? "Hook" : "技术等级",
                group.counts,
                group.memberCount,
                group.balanced
            ))
        ];
        context.getElement<HTMLDivElement>("balanceResults").innerHTML = rows.join("");
    }

    function renderSummary(context: SeasonalLearningAppContext): void {
        const people = context.state.people;
        const report = context.logic.checkBalance(
            people,
            context.state.periodCount,
            context.state.enabledBalanceHookIds
        );
        const operationalPeople = people.filter((person) => !BalanceFilter.shouldIgnoreOperational(person));
        const summary = [
            { key: "total", label: "总人数", value: people.length },
            { key: "leader", label: "带队机长", value: operationalPeople.filter((person) => person.category === "leader").length },
            { key: "captain", label: "机长", value: operationalPeople.filter((person) => person.category === "captain").length },
            { key: "first-officer", label: "副驾驶", value: operationalPeople.filter((person) => person.category === "firstOfficer").length },
            { key: "us-line-leader", label: "美线带队", value: operationalPeople.filter((person) => person.isUsLineLeader).length },
            { key: "pending", label: "待分配", value: report.pendingCount },
            { key: "adjusted", label: "人工调整", value: people.filter((person) => person.adjusted).length }
        ];
        context.getElement<HTMLDivElement>("summaryStrip").innerHTML = summary.map((item) => `
            <div class="summary-item summary-${item.key}">
                <span>${context.escapeHtml(item.label)}</span>
                <strong>${context.escapeHtml(item.value)}</strong>
            </div>
        `).join("");
    }

    function cssColor(name: string, fallback: string): string {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    function renderChart(context: SeasonalLearningAppContext): void {
        const element = context.getElement<HTMLDivElement>("distributionChart");
        if (!context.echarts) {
            element.textContent = "图表组件未加载。";
            return;
        }
        const summaries = context.logic.buildPeriodSummaries(
            context.state.people,
            context.state.periodDates,
            context.state.periodCount,
            context.state.enabledBalanceHookIds
        );
        context.state.chart = context.state.chart || context.echarts.init(element);
        const textColor = cssColor("--watchdog-text", "#1f2328");
        const mutedColor = cssColor("--watchdog-text-muted", "#656d76");
        const borderColor = cssColor("--watchdog-border", "#d0d7de");
        const surfaceColor = cssColor("--watchdog-surface", "#ffffff");
        context.state.chart.setOption({
            animationDuration: 280,
            color: [
                cssColor("--season-leader-chart", "#a8c4e5"),
                cssColor("--season-captain-chart", "#a6d2c8"),
                cssColor("--season-first-officer-chart", "#9ba3b8"),
                cssColor("--season-us-line-chart", "#a9c9bf"),
                cssColor("--season-total-chart", "#9c91ae")
            ],
            tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
                backgroundColor: surfaceColor,
                borderColor,
                textStyle: { color: textColor }
            },
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
                { name: "美线带队", type: "line", data: summaries.map((item) => item.usLineLeader), symbolSize: 6, lineStyle: { width: 2, type: "dashed" } },
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
            context.state.periodCount,
            context.state.enabledBalanceHookIds
        );
        context.getElement<HTMLDivElement>("periodCards").innerHTML = summaries.map((summary) => {
            const people = context.state.people.filter((person) => person.period === summary.period);
            const issueLabels = summary.issues.slice(0, 2).join("、");
            const status = summary.issues.length
                ? `需检查：${issueLabels}${summary.issues.length > 2 ? `等 ${summary.issues.length} 项` : ""}`
                : "均衡";
            return `
                <article class="period-card ${summary.issues.length ? "has-issue" : ""}" data-person-scope="period-${summary.period}">
                    <header class="period-card-header">
                        <div class="period-title">
                            <h3>第${summary.period}期</h3>
                            <span>${context.escapeHtml(summary.date || "日期未填写")}</span>
                        </div>
                        <div class="period-counts">
                            <span class="count-total"><b>${summary.total}</b> 总人数</span>
                            <span class="count-leader"><b>${summary.leader}</b> 带队机长</span>
                            <span class="count-captain"><b>${summary.captain}</b> 机长</span>
                            <span class="count-first-officer"><b>${summary.firstOfficer}</b> 副驾驶</span>
                            <span class="count-us-line-leader"><b>${summary.usLineLeader}</b> 美线带队</span>
                        </div>
                        <div class="period-actions">
                            <span class="period-status">${context.escapeHtml(status)}</span>
                            <button class="btn btn-outline-secondary btn-sm move-scope-button" type="button" data-move-scope="period-${summary.period}" disabled>移动所选</button>
                        </div>
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

    function renderPersonNames(context: SeasonalLearningAppContext, people: SeasonalLearningHealthPerson[]): string {
        return people.length
            ? people.map((person) => `<span>${context.escapeHtml(person.name || person.employeeId)}</span>`).join("")
            : '<span class="empty-log">无</span>';
    }

    function renderIdentityGroups(context: SeasonalLearningAppContext, people: SeasonalLearningHealthPerson[]): string {
        const grouped = new Map<string, SeasonalLearningHealthPerson[]>();
        people.forEach((person) => {
            const group = grouped.get(person.identity) || [];
            group.push(person);
            grouped.set(person.identity, group);
        });
        return [...grouped.entries()].map(([identity, group]) => `
            <div class="identity-audit-group">
                <div class="identity-audit-heading">
                    ${renderIdentity(context, identity)}
                    <span>${group.length} 人</span>
                </div>
                <div class="health-name-list">${renderPersonNames(context, group)}</div>
            </div>
        `).join("");
    }

    function renderHealth(context: SeasonalLearningAppContext): void {
        const section = context.getElement<HTMLElement>("healthSection");
        const health = context.state.health;
        section.hidden = !health;
        if (!health) return;

        context.getElement<HTMLDivElement>("healthSummary").innerHTML = `
            <span class="health-pill health-error">严重 ${health.summary.error}</span>
            <span class="health-pill health-warning">警告 ${health.summary.warning}</span>
            <span class="health-pill health-info">提示 ${health.summary.info}</span>
        `;
        context.getElement<HTMLDivElement>("healthContent").innerHTML = `
            <div class="health-metrics">
                <span><b>${health.totalCount}</b> 总名单</span>
                <span><b>${health.actualCount}</b> 实际名单</span>
                <span><b>${health.totalTagged.length}</b> 有身份</span>
                <span><b>${health.totalUntagged.length}</b> 未标身份</span>
            </div>
            <div class="health-list">
                ${health.items.map((item) => `
                    <div class="health-item health-item-${item.level}">
                        <span class="health-level">${item.level === "error" ? "严重" : item.level === "warning" ? "警告" : "提示"}</span>
                        <span class="health-area">${context.escapeHtml(item.area)}</span>
                        <span class="health-message">${context.escapeHtml(item.message)}</span>
                        ${item.detail ? `<span class="health-detail">${context.escapeHtml(item.detail)}</span>` : ""}
                    </div>
                `).join("")}
            </div>
            <div class="identity-audit">
                <details open>
                    <summary>总名单带身份人员 ${health.totalTagged.length}</summary>
                    ${renderIdentityGroups(context, health.totalTagged)}
                </details>
                <details>
                    <summary>总名单未标身份人员 ${health.totalUntagged.length}</summary>
                    <div class="health-name-list">${renderPersonNames(context, health.totalUntagged)}</div>
                </details>
            </div>
        `;
    }

    function updateMoveButtons(context: SeasonalLearningAppContext): void {
        document.querySelectorAll<HTMLButtonElement>(".move-scope-button").forEach((button) => {
            const scope = button.dataset.moveScope;
            const container = scope ? document.querySelector<HTMLElement>(`[data-person-scope="${scope}"]`) : null;
            const count = container?.querySelectorAll<HTMLInputElement>(".person-checkbox:checked").length || 0;
            button.disabled = !context.state.scheduleReady || count === 0;
            button.textContent = count ? `移动所选 ${count}` : "移动所选";
        });
    }

    function renderAll(context: SeasonalLearningAppContext): void {
        const workspace = context.getElement<HTMLElement>("workspace");
        workspace.hidden = !context.state.initialized;
        context.getElement<HTMLButtonElement>("exportButton").disabled = !context.state.initialized;
        const balanceButton = context.getElement<HTMLButtonElement>("balanceButton");
        balanceButton.disabled = !context.state.initialized;
        balanceButton.textContent = context.state.scheduleReady ? "均衡检查" : "均衡负载";
        context.getElement<HTMLInputElement>("periodCount").disabled = context.state.scheduleReady;
        renderBalanceRules(context);
        renderHealth(context);
        if (!context.state.initialized) {
            renderDateControls(context);
            return;
        }
        renderDateControls(context);
        renderSummary(context);
        renderBalanceResults(context);
        renderChart(context);
        renderPending(context);
        renderPeriodCards(context);
        renderChanges(context);
        renderLog(context);
        updateMoveButtons(context);
    }

export const SeasonalLearningView = {
        renderAll,
        renderDateControls,
        renderChart,
        renderHealth,
        updateMoveButtons
    };
