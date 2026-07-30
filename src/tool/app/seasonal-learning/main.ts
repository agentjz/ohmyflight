(function () {
    const namespace = window.SeasonalLearningApp;

    function previousState(context: SeasonalLearningAppContext): SeasonalLearningPreviousState | null {
        if (!context.state.initialized) return null;
        return {
            people: context.state.people,
            periodDates: context.state.periodDates,
            periodCount: context.state.periodCount,
            scheduleReady: context.state.scheduleReady
        };
    }

    function importedAdjustmentLog(people: SeasonalLearningPerson[]): string[] {
        return people.flatMap((person) => person.adjustmentNotes.map((note) => `${person.name}：${note}`));
    }

    async function handleFile(context: SeasonalLearningAppContext, event: Event): Promise<void> {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;
        const file = input.files?.[0];
        if (!file) return;

        context.setStatus("正在读取换季名单…");
        context.state.health = null;
        namespace.View?.renderHealth(context);
        try {
            const stateBeforeImport = previousState(context);
            const datesBeforeImport = { ...context.state.periodDates };
            const workbook = await context.readWorkbook(file);
            const totalRows = context.sheetRows(workbook, "换季总名单");
            const actualRows = context.sheetRows(workbook, "换季实际");
            context.state.health = context.health.buildWorkbookHealth(totalRows, actualRows);
            namespace.View?.renderHealth(context);
            const requestedPeriodCount = Number(context.getElement<HTMLInputElement>("periodCount").value);
            const result = context.logic.buildImportResult(
                totalRows,
                actualRows,
                requestedPeriodCount,
                stateBeforeImport,
                { date1904: context.workbookUses1904Dates(workbook) }
            );
            if (result.mode === "pending" && !stateBeforeImport) {
                Object.keys(result.periodDates).forEach((key) => {
                    const period = Number(key);
                    result.periodDates[period] = datesBeforeImport[period] || "";
                });
            }
            const oldLog = [...context.state.adjustmentLog];
            context.state.sourceWorkbook = workbook;
            context.state.sourceFileName = file.name;
            context.state.initialized = true;
            context.state.mode = result.mode;
            context.state.scheduleReady = result.scheduleReady;
            context.state.people = result.people;
            context.state.periodDates = result.periodDates;
            context.state.periodCount = result.periodCount;
            context.state.addedEmployeeIds = result.addedEmployeeIds;
            context.state.removedPeople = result.removedPeople;
            context.state.adjustmentLog = result.mode === "actual" ? importedAdjustmentLog(result.people) : oldLog;
            context.state.pendingMoveIds = [];
            context.getElement<HTMLInputElement>("periodCount").value = String(result.periodCount);
            renderTargetOptions(context);

            const pendingCount = result.people.filter((person) => person.period === null).length;
            const restoredCount = result.people.length - pendingCount;
            const message = result.mode === "pending"
                ? `已导入 ${result.people.length} 人，点击“均衡负载”生成初版。`
                : result.mode === "actual"
                    ? `已从换季实际恢复 ${restoredCount} 人，${pendingCount} 人待分配。`
                    : `已更新总名单：新增 ${result.addedEmployeeIds.length} 人，删除 ${result.removedPeople.length} 人。`;
            const needsAttention = result.addedEmployeeIds.length
                || result.removedPeople.length
                || (context.state.health?.summary.warning || 0) > 0;
            context.setStatus(message, needsAttention ? "warning" : "success");
            context.setActionMessage("");
            namespace.View?.renderAll(context);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            context.setStatus(`导入失败：${message}`, "danger");
        } finally {
            input.value = "";
        }
    }

    function selectedEmployeeIds(scope: string): string[] {
        const container = document.querySelector<HTMLElement>(`[data-person-scope="${scope}"]`);
        if (!container) return [];
        return Array.from(container.querySelectorAll<HTMLInputElement>(".person-checkbox:checked")).map((input) => input.value);
    }

    function applyOperation(context: SeasonalLearningAppContext, operation: SeasonalLearningOperationResult): void {
        context.state.people = operation.people;
        context.state.adjustmentLog.push(...operation.events.map((event) => event.text));
        context.setActionMessage(operation.events.map((event) => event.text).join("；"), "success");
        namespace.View?.renderAll(context);
    }

    interface MoveModalInstance {
        show(): void;
        hide(): void;
    }

    function moveModal(context: SeasonalLearningAppContext): MoveModalInstance {
        const modalApi = (window as typeof window & {
            bootstrap?: { Modal?: { getOrCreateInstance(element: HTMLElement): MoveModalInstance } };
        }).bootstrap?.Modal;
        if (!modalApi) throw new Error("移动弹窗组件未加载。");
        return modalApi.getOrCreateInstance(context.getElement<HTMLElement>("moveModal"));
    }

    function openMoveModal(context: SeasonalLearningAppContext, scope: string): void {
        try {
            if (!context.state.scheduleReady) throw new Error("请先点击“均衡负载”生成初版。");
            const employeeIds = selectedEmployeeIds(scope);
            if (!employeeIds.length) throw new Error("请至少选择一人。");
            const selected = new Set(employeeIds);
            const names = context.state.people.filter((person) => selected.has(person.employeeId)).map((person) => person.name);
            context.state.pendingMoveIds = employeeIds;
            const summary = context.getElement<HTMLDivElement>("moveSelectionSummary");
            summary.className = "move-selection-summary";
            summary.textContent = `已选择 ${names.length} 人：${names.join("、")}`;
            context.getElement<HTMLSelectElement>("moveTargetPeriod").value = "";
            moveModal(context).show();
        } catch (error) {
            context.setActionMessage(error instanceof Error ? error.message : String(error), "danger");
        }
    }

    function confirmMove(context: SeasonalLearningAppContext): void {
        try {
            const targetPeriod = Number(context.getElement<HTMLSelectElement>("moveTargetPeriod").value);
            const operation = context.logic.movePeople(
                context.state.people,
                context.state.pendingMoveIds,
                targetPeriod,
                context.state.periodCount
            );
            context.state.pendingMoveIds = [];
            moveModal(context).hide();
            applyOperation(context, operation);
        } catch (error) {
            const summary = context.getElement<HTMLDivElement>("moveSelectionSummary");
            summary.className = "move-selection-summary is-error";
            summary.textContent = error instanceof Error ? error.message : String(error);
        }
    }

    function renderTargetOptions(context: SeasonalLearningAppContext): void {
        context.getElement<HTMLSelectElement>("moveTargetPeriod").innerHTML = [
            '<option value="">请选择目标期次</option>',
            ...Array.from(
            { length: context.state.periodCount },
            (_, index) => `<option value="${index + 1}">第${index + 1}期</option>`
            )
        ].join("");
    }

    function exportWorkbook(context: SeasonalLearningAppContext): void {
        if (!context.state.sourceWorkbook) return;
        try {
            const workbook = context.exporter.buildExportWorkbook(
                context.state.sourceWorkbook,
                context.state.people,
                context.state.periodDates
            );
            window.XLSX.writeFile(workbook, context.exporter.buildOutputFileName(context.state.sourceFileName));
            context.setActionMessage("已导出换季实际工作簿。", "success");
        } catch (error) {
            context.setActionMessage(error instanceof Error ? error.message : String(error), "danger");
        }
    }

    function balanceOrCheck(context: SeasonalLearningAppContext): void {
        if (!context.state.scheduleReady) {
            context.state.people = context.logic.buildInitialSchedule(
                context.state.people,
                context.state.periodCount,
                context.state.enabledBalanceHookIds
            );
            context.state.scheduleReady = true;
            context.setActionMessage("均衡负载已生成初版；后续均衡检查不会改动人员期次。", "success");
            namespace.View?.renderAll(context);
            return;
        }

        const report = context.logic.checkBalance(
            context.state.people,
            context.state.periodCount,
            context.state.enabledBalanceHookIds
        );
        const pendingText = report.operationalPendingCount
            ? `另有 ${report.operationalPendingCount} 名运行人员待分配。`
            : "";
        const unbalancedGroupCount = report.groups.filter((group) => !group.balanced).length;
        const differenceText = [
            ...(!report.total.balanced ? ["总人数"] : []),
            ...(unbalancedGroupCount ? [`${unbalancedGroupCount} 个均衡组`] : [])
        ].join("和");
        context.setActionMessage(
            report.balanced
                ? `当前分布在允许范围内，人员期次未改动。${pendingText}`
                : `${differenceText || "当前安排"}存在差异，人员期次未改动。${pendingText}`,
            report.balanced ? "success" : "warning"
        );
    }

    function bindEvents(context: SeasonalLearningAppContext): void {
        context.getElement<HTMLInputElement>("workbookFile").addEventListener("change", (event) => { void handleFile(context, event); });
        context.getElement<HTMLInputElement>("periodCount").addEventListener("change", (event) => {
            const input = event.target as HTMLInputElement;
            const value = Math.max(1, Math.min(30, Number(input.value) || 6));
            context.state.periodCount = value;
            context.state.periodDates = Object.fromEntries(
                Array.from({ length: value }, (_, index) => [index + 1, context.state.periodDates[index + 1] || ""])
            );
            input.value = String(value);
            namespace.View?.renderDateControls(context);
            renderTargetOptions(context);
        });
        context.getElement<HTMLDivElement>("dateControls").addEventListener("change", (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || !input.classList.contains("period-date")) return;
            const period = Number(input.dataset.period);
            context.state.periodDates[period] = input.value;
            namespace.View?.renderAll(context);
        });
        context.getElement<HTMLDivElement>("balanceRuleControls").addEventListener("change", (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement) || !input.classList.contains("balance-hook-checkbox")) return;
            const selected = Array.from(
                context.getElement<HTMLDivElement>("balanceRuleControls")
                    .querySelectorAll<HTMLInputElement>(".balance-hook-checkbox:checked")
            ).map((checkbox) => checkbox.value);
            context.state.enabledBalanceHookIds = context.rules.normalizeEnabledHookIds(selected);
            namespace.View?.renderAll(context);
        });
        context.getElement<HTMLElement>("workspace").addEventListener("change", (event) => {
            const input = event.target;
            if (input instanceof HTMLInputElement && input.classList.contains("person-checkbox")) {
                namespace.View?.updateMoveButtons(context);
            }
        });
        context.getElement<HTMLElement>("workspace").addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const button = target.closest<HTMLButtonElement>(".move-scope-button");
            const scope = button?.dataset.moveScope;
            if (!button || !scope) return;
            openMoveModal(context, scope);
        });
        context.getElement<HTMLButtonElement>("confirmMoveButton").addEventListener("click", () => confirmMove(context));
        context.getElement<HTMLButtonElement>("balanceButton").addEventListener("click", () => balanceOrCheck(context));
        context.getElement<HTMLButtonElement>("exportButton").addEventListener("click", () => exportWorkbook(context));
        window.addEventListener("resize", () => context.state.chart?.resize());
        window.addEventListener("ohmyflight:themechange", () => {
            if (context.state.initialized) namespace.View?.renderChart(context);
        });
    }

    function init(): void {
        if (!namespace.AppContext || !namespace.View) throw new Error("换季学习页面初始化失败。");
        const context = namespace.AppContext.createAppContext();
        namespace.context = context;
        bindEvents(context);
        renderTargetOptions(context);
        namespace.View.renderAll(context);
    }

    document.addEventListener("DOMContentLoaded", init);
})();
