(function () {
    const runtime = window as SessionBillRuntime;
    const namespace = runtime.SessionBillCheck || (runtime.SessionBillCheck = {});

    function renderFileInfo(context: SessionBillAppContext): void {
        const state = context.state;
        const sessionText = state.sessionAnalysis
            ? `场次表：${state.sessionFileName}；sheet ${state.sessionAnalysis.sheetName}；拆分 ${state.sessionAnalysis.entries.length} 人次`
            : "场次表：未上传";
        const billText = state.billAnalysis
            ? `账单表：${state.billFileName}；sheet ${state.billAnalysis.sheetNames.join("、")}；读取 ${state.billAnalysis.entries.length} 人次`
            : "账单表：未上传";
        context.getElement<HTMLDivElement>("fileInfo").innerHTML = `
            <div>${context.escapeHtml(sessionText)}</div>
            <div>${context.escapeHtml(billText)}</div>
        `;
    }

    function renderSummary(context: SessionBillAppContext): void {
        const summary = context.state.result?.summary;
        const cards = summary
            ? [
                ["场次总人次", summary.sessionTotal],
                ["账单总人次", summary.billTotal],
                ["参与核对姓名", summary.comparedNames],
                ["一致姓名", summary.matchedNames],
                ["差异姓名", summary.mismatchNames]
            ]
            : [
                ["场次总人次", "-"],
                ["账单总人次", "-"],
                ["参与核对姓名", "-"],
                ["一致姓名", "-"],
                ["差异姓名", "-"]
            ];

        context.getElement<HTMLDivElement>("summaryGrid").innerHTML = cards.map(([label, value]) => `
            <article class="summary-card">
                <span>${context.escapeHtml(label)}</span>
                <strong>${context.escapeHtml(value)}</strong>
            </article>
        `).join("");
    }

    function renderCharts(context: SessionBillAppContext): void {
        const result = context.state.result;
        const chartElement = context.getElement<HTMLDivElement>("statusChart");
        if (!result) {
            chartElement.innerHTML = '<div class="empty-block">上传两张表后显示状态分布。</div>';
            return;
        }

        const echarts = context.runtime.echarts;
        if (!echarts) throw new Error("ECharts 未加载。");

        chartElement.innerHTML = "";
        const chart = echarts.init(chartElement);
        chart.setOption({
            color: ["#2f9e44", "#8f72b5", "#1971c2", "#718096", "#c4567a"],
            tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
            legend: { orient: "vertical", right: 10, top: "middle" },
            series: [{
                name: "状态",
                type: "pie",
                radius: ["45%", "72%"],
                center: ["38%", "50%"],
                avoidLabelOverlap: true,
                label: { formatter: "{b} {c}", fontSize: 12 },
                data: result.statusRows.map((row) => ({ name: row.status, value: row.total }))
            }]
        });
    }

    function badgeClass(status: SessionBillStatus): string {
        if (status === "一致") return "text-bg-success";
        if (status === "场次多" || status === "仅场次有") return "text-bg-warning";
        return "text-bg-primary";
    }

    function shortRefs(refs: string, count: number): string {
        if (!refs) return "-";
        const first = refs.split("；")[0] || "";
        return count > 1 ? `${first} 等 ${count} 条` : first;
    }

    function renderTable(context: SessionBillAppContext): void {
        const rows = context.filteredRows();
        const body = context.getElement<HTMLTableSectionElement>("resultBody");
        context.getElement<HTMLSpanElement>("rowCount").textContent = String(rows.length);

        if (!context.state.result) {
            body.innerHTML = '<tr><td colspan="8" class="empty-block">上传两张表后显示核对明细。</td></tr>';
            return;
        }
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="8" class="empty-block">当前筛选没有记录。</td></tr>';
            return;
        }

        body.innerHTML = rows.map((row) => `
            <tr data-key="${context.escapeHtml(row.key)}" class="${row.key === context.state.selectedKey ? "table-active" : ""}">
                <td><span class="badge ${badgeClass(row.status)}">${context.escapeHtml(row.status)}</span></td>
                <td class="name-cell" title="${context.escapeHtml(row.matchedNames)}">${context.escapeHtml(row.name)}${row.matchedNames && row.matchedNames !== row.name ? `<div class="text-muted small">${context.escapeHtml(row.matchedNames)}</div>` : ""}</td>
                <td class="number-cell">${context.escapeHtml(row.sessionCount)}</td>
                <td class="number-cell">${context.escapeHtml(row.billCount)}</td>
                <td class="number-cell ${row.diff === 0 ? "" : row.diff > 0 ? "text-danger" : "text-primary"}">${context.escapeHtml(row.diff)}</td>
                <td class="refs-cell" title="${context.escapeHtml(row.sessionRefs)}">${context.escapeHtml(shortRefs(row.sessionRefs, row.sessionCount))}</td>
                <td class="refs-cell" title="${context.escapeHtml(row.billRefs)}">${context.escapeHtml(shortRefs(row.billRefs, row.billCount))}</td>
                <td>${context.escapeHtml(row.note)}</td>
            </tr>
        `).join("");

        body.querySelectorAll<HTMLTableRowElement>("tr[data-key]").forEach((rowElement) => {
            rowElement.addEventListener("click", () => {
                context.state.selectedKey = rowElement.dataset.key || "";
                renderTable(context);
                renderSelectedDetail(context);
            });
        });
    }

    function formatEntryFields(entry: SessionBillSourceEntry): string[] {
        return [
            entry.role ? `角色：${entry.role}` : "",
            entry.dateText ? `日期：${entry.dateText}` : "",
            entry.startText || entry.endText ? `时间：${entry.startText || "-"} ~ ${entry.endText || "-"}` : "",
            entry.groupText ? `组号：${entry.groupText}` : "",
            entry.natureText ? `训练性质：${entry.natureText}` : "",
            entry.modelText ? `机型：${entry.modelText}` : "",
            entry.deviceText ? `设备：${entry.deviceText}` : "",
            entry.quantityText ? `数量：${entry.quantityText}` : "",
            entry.amountText ? `金额：${entry.amountText}` : ""
        ].filter(Boolean);
    }

    function renderEntryList(context: SessionBillAppContext, entries: SessionBillSourceEntry[], emptyText: string): string {
        if (!entries.length) return `<div class="empty-block compact">${context.escapeHtml(emptyText)}</div>`;
        return `<ol class="source-list">${entries.map((entry) => `
            <li>
                <div class="source-entry-head">
                    <span class="source-entry-name">${context.escapeHtml(entry.name)}</span>
                    <span class="source-entry-ref">${context.escapeHtml(entry.sheetName)}!第${context.escapeHtml(entry.rowNumber)}行</span>
                </div>
                <div class="source-meta">
                    ${formatEntryFields(entry).map((field) => `<span class="source-chip">${context.escapeHtml(field)}</span>`).join("")}
                </div>
            </li>
        `).join("")}</ol>`;
    }

    function renderSelectedDetail(context: SessionBillAppContext): void {
        const panel = context.getElement<HTMLDivElement>("selectedDetail");
        if (!context.state.result || !context.state.selectedKey) {
            panel.innerHTML = '<div class="empty-block compact">点击上方姓名行后，这里显示该人的场次和账单来源明细。</div>';
            return;
        }
        const row = context.state.result.rows.find((item) => item.key === context.state.selectedKey);
        const group = context.state.result.groupsByKey[context.state.selectedKey];
        if (!row || !group) {
            panel.innerHTML = '<div class="empty-block compact">未找到来源明细。</div>';
            return;
        }
        panel.innerHTML = `
            <div class="selected-title">
                <div>
                    <strong>${context.escapeHtml(row.name)}</strong>
                    ${row.matchedNames !== row.name ? `<span class="text-muted small">${context.escapeHtml(row.matchedNames)}</span>` : ""}
                </div>
                <span class="badge ${badgeClass(row.status)}">${context.escapeHtml(row.status)}</span>
            </div>
            <div class="row g-3">
                <div class="col-12 col-xl-6">
                    <h6 class="source-heading">场次来源 ${group.sessionEntries.length} 条</h6>
                    ${renderEntryList(context, group.sessionEntries, "场次表没有该姓名。")}
                </div>
                <div class="col-12 col-xl-6">
                    <h6 class="source-heading">账单来源 ${group.billEntries.length} 条</h6>
                    ${renderEntryList(context, group.billEntries, "账单表没有该姓名。")}
                </div>
            </div>
        `;
    }

    function renderAll(context: SessionBillAppContext): void {
        renderFileInfo(context);
        renderSummary(context);
        renderCharts(context);
        renderTable(context);
        renderSelectedDetail(context);
        context.getElement<HTMLButtonElement>("exportButton").disabled = !context.state.result;
    }

    namespace.View = {
        renderAll,
        renderSelectedDetail,
        renderTable
    };
})();
