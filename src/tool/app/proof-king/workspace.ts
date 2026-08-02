import { ManualProofDecisions as Decisions } from "./decision-model";
import { createProjectArchive } from "../../project-archive";
import { createExcelReport } from "./excel-report";
import { createManualReader } from "./manual-reader";
import type {
    ComparisonWorkerFailure,
    ComparisonWorkerProgress,
    ComparisonWorkerRequest,
    ComparisonWorkerSuccess,
    LocalManual,
    ManualComparison,
    ManualProofHookConfig,
    ManualRole,
    ProofProjectActionsContext,
    ProofProjectReadResult,
    ProofWorkspaceProjectInput,
    RevisionChapterGroup,
    RevisionCategoryCount,
    RevisionDecision,
    RevisionDecisionMap,
    RevisionDecisionSummary,
    RevisionEvent,
    RevisionKind,
    RevisionNavigationEvent
} from "./models";
import { ManualProofNavigation as Navigation } from "./navigation";
import { createProjectActions } from "./project-actions";
import { createProjectPackage } from "./project-package";
import { ManualProofRevisionNavigationView as RevisionNavigationView } from "./revision-navigation-view";
import { RevisionReviewView } from "./revision-review-view";
import { createWordReport } from "./word-report";

type WorkspaceDependencies = {
    mammoth: { extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value?: string }> } | null;
    pdfjsLib: any;
    xlsx: typeof import("xlsx-js-style");
    docx: any;
    JSZip: any;
    hooks: ManualProofHookConfig;
};

export function createWorkspace(dependencies: WorkspaceDependencies) {
    const ManualReader = createManualReader(dependencies);
    const ExcelReport = createExcelReport(dependencies.xlsx);
    const WordReport = createWordReport(dependencies.docx);
    const archive = createProjectArchive(dependencies.JSZip);
    const ProjectPackage = createProjectPackage(archive);
    const ProjectActions = createProjectActions(archive, ProjectPackage, ExcelReport);

    const state: {
        myManual: LocalManual | null;
        referenceManual: LocalManual | null;
        comparison: ManualComparison | null;
        outline: RevisionChapterGroup[];
        visibleEvents: RevisionNavigationEvent[];
        selectedId: string;
        filter: RevisionKind | "all";
        query: string;
        chapterKey: string;
        sectionKey: string;
        decisions: RevisionDecisionMap;
        onlyIncluded: boolean;
        dirty: boolean;
        worker: Worker | null;
        requestId: number;
        previewRequestId: number;
    } = {
        myManual: null,
        referenceManual: null,
        comparison: null,
        outline: [],
        visibleEvents: [],
        selectedId: "",
        filter: "all",
        query: "",
        chapterKey: "",
        sectionKey: "",
        decisions: {},
        onlyIncluded: false,
        dirty: false,
        worker: null,
        requestId: 0,
        previewRequestId: 0
    };

    let reviewView: any;
    let navigationFrame: number | null = null;

    function bind(): void {
        reviewView = new RevisionReviewView();

        input("myInput").addEventListener("change", () => void safely(() => loadManual("my")));
        input("referenceInput").addEventListener("change", () => void safely(() => loadManual("reference")));
        button("compareButton").addEventListener("click", () => void safely(startComparison));
        element("reportActions").addEventListener("click", (event) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>("[data-report-format][data-report-scope]");
            if (!target || !state.comparison) return;
            const comparison = state.comparison;
            const included = Decisions.eventsWith(comparison.events, state.decisions, "included") as RevisionEvent[];
            const events = target.dataset.reportScope === "included" ? included : comparison.events;
            const scope = target.dataset.reportScope === "included" ? "纳入报告" : "全部";
            if (!events.length) return setMessage(`当前没有可导出的${scope}事件。`, "danger");
            if (target.dataset.reportFormat === "excel") ExcelReport.exportWorkbook(comparison, events, state.decisions, scope);
            else void safely(() => WordReport.exportDocument(comparison, events, scope));
        });
        input("eventSearch").addEventListener("input", () => {
            state.query = input("eventSearch").value;
            markDirty();
            applyFilter();
        });
        element("filterBar").addEventListener("click", (event) => {
            const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-filter]");
            if (!target?.dataset.filter) return;
            state.filter = target.dataset.filter as RevisionKind | "all";
            markDirty();
            applyFilter();
        });
        input("onlyIncluded").addEventListener("change", () => {
            state.onlyIncluded = input("onlyIncluded").checked;
            markDirty();
            applyFilter();
        });
        element("chapterNavigation").addEventListener("click", (event) => {
            const section = (event.target as HTMLElement).closest<HTMLElement>("[data-section-key]");
            if (section?.dataset.sectionKey && section.dataset.startEventId) {
                selectSection(section.dataset.sectionKey, section.dataset.startEventId);
                return;
            }
            const chapter = (event.target as HTMLElement).closest<HTMLElement>("[data-chapter-key]");
            if (chapter?.dataset.chapterKey) selectChapter(chapter.dataset.chapterKey);
        });
        element("eventNavigation").addEventListener("scroll", scheduleNavigation);
        element("eventNavigation").addEventListener("click", (event) => {
            const decisionToggle = (event.target as HTMLElement).closest<HTMLInputElement>("[data-decision-toggle]");
            if (decisionToggle?.dataset.decisionToggle) {
                setDecision(decisionToggle.dataset.decisionToggle, decisionToggle.checked ? "included" : "pending");
                return;
            }
            if ((event.target as HTMLElement).closest(".event-include")) return;
            const target = (event.target as HTMLElement).closest<HTMLElement>("[data-event-id]");
            if (!target?.dataset.eventId) return;
            state.selectedId = target.dataset.eventId;
            renderNavigation();
            void safely(renderSelection);
        });
        element("eventNavigation").addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const target = (event.target as HTMLElement).closest<HTMLElement>("[data-event-id]");
            if (!target?.dataset.eventId) return;
            event.preventDefault();
            state.selectedId = target.dataset.eventId;
            renderNavigation();
            void safely(renderSelection);
        });
        element("decisionBar").addEventListener("click", (event) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>("[data-decision]");
            if (target?.dataset.decision && state.selectedId) setDecision(state.selectedId, target.dataset.decision as RevisionDecision);
        });
        element("batchActions").addEventListener("click", (event) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>("[data-batch-decision]");
            if (!target?.dataset.batchDecision || !state.visibleEvents.length) return;
            state.decisions = Decisions.setMany(
                state.decisions,
                state.visibleEvents.map((item) => item.id),
                target.dataset.batchDecision as RevisionDecision
            );
            markDirty();
            applyFilter(false);
        });
        ProjectActions.bind({
            getProjectInput,
            restoreProject,
            markProjectSaved,
            setMessage
        } as ProofProjectActionsContext);
        window.addEventListener("beforeunload", (event) => {
            if (!state.dirty) return;
            event.preventDefault();
            event.returnValue = "";
        });
        renderState();
    }

    async function loadManual(role: ManualRole): Promise<void> {
        const fileInput = input(role === "my" ? "myInput" : "referenceInput");
        const file = fileInput.files?.[0];
        if (!file) return;
        setMessage(`正在读取${role === "my" ? "我的手册" : "参考手册"}：${file.name}`, "info");
        const manual = await ManualReader.readManual(file, role, pdfRange(role));
        if (role === "my") state.myManual = manual;
        else state.referenceManual = manual;
        clearComparison();
        markDirty();
        if (state.myManual && state.referenceManual) {
            setMessage(`当前方向：我的手册「${state.myManual.name}」→ 参考手册「${state.referenceManual.name}」。`, "info");
        } else {
            setMessage(`${role === "my" ? "我的手册" : "参考手册"}读取完成，共 ${manual.units.length} 个原文单元。`, "success");
        }
        renderState();
        await showInitialManual(manual);
    }

    async function showInitialManual(manual: LocalManual): Promise<void> {
        await reviewView.showInitial(manual);
    }

    async function startComparison(): Promise<void> {
        if (!state.myManual || !state.referenceManual) throw new Error("请先上传我的手册和参考手册。 ");
        clearComparison();
        state.requestId += 1;
        const requestId = state.requestId;
        const worker = new Worker("comparison-worker.js", { type: "module" });
        state.worker = worker;
        button("compareButton").disabled = true;
        setMessage("正在后台建立原文锚点和顺序对应，页面仍可操作。", "info");
        worker.addEventListener("message", (event: MessageEvent<ComparisonWorkerProgress | ComparisonWorkerSuccess | ComparisonWorkerFailure>) => {
            const response = event.data;
            if (!response || response.requestId !== state.requestId) return;
            if (response.type === "progress") {
                const { phase, completed, total } = response.progress;
                setMessage(`${phase}${total ? `：${completed}/${total}` : ""}`, "info");
                return;
            }
            stopWorker();
            button("compareButton").disabled = false;
            if (response.type === "failure") {
                setMessage(response.message, "danger");
                return;
            }
            state.comparison = response.comparison;
            state.filter = "all";
            state.query = "";
            state.chapterKey = "";
            state.sectionKey = "";
            state.decisions = {};
            state.onlyIncluded = false;
            input("onlyIncluded").checked = false;
            input("eventSearch").value = "";
            markDirty();
            applyFilter();
            setMessage(`比对完成：${response.comparison.summary.myManualName} → ${response.comparison.summary.referenceManualName}，整理为 ${response.comparison.events.length} 个修订事件。`, "success");
        });
        worker.addEventListener("error", () => {
            if (requestId !== state.requestId) return;
            stopWorker();
            button("compareButton").disabled = false;
            setMessage("后台比对异常终止，请重新开始。", "danger");
        });
        worker.postMessage({
            type: "compare",
            requestId,
            myManual: ManualReader.toWorkerManual(state.myManual),
            referenceManual: ManualReader.toWorkerManual(state.referenceManual)
        } as ComparisonWorkerRequest);
    }

    function applyFilter(resetScroll = true): void {
        const filtered = state.comparison
            ? Navigation.filterEvents(state.comparison.events, state.filter, state.query) as RevisionNavigationEvent[]
            : [];
        state.visibleEvents = state.onlyIncluded
            ? Decisions.eventsWith(filtered, state.decisions, "included") as RevisionNavigationEvent[]
            : filtered;
        state.outline = Navigation.buildOutline(state.visibleEvents, "all", "");
        const chapter = state.outline.find((item) => item.key === state.chapterKey) || state.outline[0];
        state.chapterKey = chapter?.key || "";
        const section = chapter?.sections.find((item) => item.key === state.sectionKey) || chapter?.sections[0];
        state.sectionKey = section?.key || "";
        if (!state.visibleEvents.some((event) => event.id === state.selectedId)) {
            state.selectedId = state.visibleEvents[0]?.id || "";
        }
        if (resetScroll) element("eventNavigation").scrollTop = 0;
        renderState();
        if (state.selectedId) void safely(renderSelection);
    }

    function renderState(): void {
        renderManualStatus();
        renderSummary();
        renderFilters();
        renderOutline();
        renderNavigation();
        element("reportActions").querySelectorAll<HTMLButtonElement>("button").forEach((item) => item.disabled = !state.comparison);
        button("saveProjectButton").disabled = !getProjectInput();
        renderDecisionSummary();
        element("projectStatus").textContent = state.dirty ? "有未保存更改" : state.comparison ? "项目已保存" : "尚未建立项目";
        element("projectStatus").className = `project-status${state.dirty ? " dirty" : ""}`;
        if (!state.selectedId) renderEmptySelection();
    }

    function renderManualStatus(): void {
        element("myStatus").textContent = manualStatus(state.myManual);
        element("referenceStatus").textContent = manualStatus(state.referenceManual);
        element("mySourceName").textContent = state.myManual?.name || "我的手册原文";
        element("referenceSourceName").textContent = state.referenceManual?.name || "参考手册原文";
    }

    function manualStatus(manual: LocalManual | null): string {
        if (!manual) return "未上传";
        const format = manual.format === "docx" ? "Word 全文阅读" : `PDF 原页，共 ${manual.pageCount} 页`;
        return `${manual.name} / ${format} / ${manual.units.length} 个原文单元`;
    }

    function renderSummary(): void {
        const summary = state.comparison?.summary;
        const values: Array<[string, number, string]> = summary ? [
            ["参考新增", summary.referenceAddedCount, "added"],
            ["参考删除", summary.referenceRemovedCount, "removed"],
            ["内容修改", summary.modifiedCount, "modified"],
            ["待确认", summary.reviewCount, "review"],
            ["顺序一致", summary.sameSliceCount, "same"]
        ] : [];
        element("summaryGrid").innerHTML = values.map(([label, value, tone]) => `
            <div class="summary-item summary-${tone}"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>
        `).join("");
    }

    function renderFilters(): void {
        const counts = Navigation.categoryCounts(
            state.comparison?.events || [],
            state.query
        ) as RevisionCategoryCount[];
        RevisionNavigationView.renderCategories(element("filterBar"), counts, state.filter, !!state.query);
    }

    function renderOutline(): void {
        RevisionNavigationView.renderOutline(
            element("chapterNavigation"),
            element("chapterCount"),
            element("sectionCount"),
            element("resultCount"),
            state.outline,
            state.chapterKey,
            state.sectionKey,
            state.visibleEvents.length,
            !!state.comparison
        );
    }

    function selectChapter(chapterKey: string): void {
        const chapter = state.outline.find((item) => item.key === chapterKey);
        if (!chapter) return;
        state.chapterKey = state.chapterKey === chapter.key ? "" : chapter.key;
        if (state.chapterKey) state.sectionKey = chapter.sections[0]?.key || "";
        renderOutline();
        markDirty();
    }

    function selectSection(sectionKey: string, startEventId: string): void {
        const index = state.visibleEvents.findIndex((item) => item.id === startEventId);
        if (index < 0) return;
        state.sectionKey = sectionKey;
        state.selectedId = startEventId;
        element("eventNavigation").scrollTop = index * Navigation.rowHeight;
        renderOutline();
        renderNavigation();
        markDirty();
        void safely(renderSelection);
    }

    function renderNavigation(): void {
        const navigation = element("eventNavigation");
        RevisionNavigationView.renderEvents(
            navigation,
            element("eventSpacer"),
            element("eventVisible"),
            state.visibleEvents,
            state.selectedId,
            state.query,
            state.decisions,
            !!state.comparison
        );
    }

    function scheduleNavigation(): void {
        if (navigationFrame !== null) return;
        navigationFrame = requestAnimationFrame(() => {
            navigationFrame = null;
            renderNavigation();
            syncOutlineFromScroll();
        });
    }

    async function renderSelection(): Promise<void> {
        const comparison = state.comparison;
        const event = state.visibleEvents.find((item) => item.id === state.selectedId)
            || comparison?.events.find((item) => item.id === state.selectedId);
        if (!comparison || !event || !state.myManual || !state.referenceManual) return;
        const requestId = ++state.previewRequestId;
        renderDecisionBar(event.id);
        await reviewView.show(event, state.myManual, state.referenceManual);
        if (requestId !== state.previewRequestId) return;
    }

    function renderEmptySelection(): void {
        reviewView.empty();
        renderDecisionBar("");
    }

    function renderDecisionBar(eventId: string): void {
        const decision = eventId ? Decisions.get(state.decisions, eventId) as RevisionDecision : "pending";
        element("decisionBar").querySelectorAll<HTMLButtonElement>("[data-decision]").forEach((item) => {
            item.classList.toggle("active", !!eventId && item.dataset.decision === decision);
            item.disabled = !eventId;
        });
    }

    function renderDecisionSummary(): void {
        const summary = Decisions.summarize(state.comparison?.events || [], state.decisions) as RevisionDecisionSummary;
        element("decisionSummary").innerHTML = [
            ["待处理", summary.pending, "pending"],
            ["纳入报告", summary.included, "included"],
            ["不纳入", summary.excluded, "excluded"]
        ].map(([label, count, tone]) => `<span class="decision-count decision-${tone}">${label}<strong>${count}</strong></span>`).join("");
    }

    function setDecision(eventId: string, decision: RevisionDecision): void {
        state.decisions = Decisions.set(state.decisions, eventId, decision);
        markDirty();
        if (state.onlyIncluded && decision !== "included") applyFilter(false);
        else {
            renderDecisionSummary();
            renderNavigation();
            renderDecisionBar(state.selectedId);
        }
    }

    function syncOutlineFromScroll(): void {
        if (!state.visibleEvents.length || !state.outline.length) return;
        const index = Math.min(
            state.visibleEvents.length - 1,
            Math.max(0, Math.floor(element("eventNavigation").scrollTop / Navigation.rowHeight))
        );
        const eventId = state.visibleEvents[index]?.id;
        const activeChapter = state.outline.find((chapter) => chapter.sections.some((section) => (
            section.events.some((event) => event.id === eventId)
        )));
        const activeSection = activeChapter?.sections.find((section) => section.events.some((event) => event.id === eventId));
        if (!eventId || !activeChapter || !activeSection) return;
        if (state.chapterKey !== activeChapter.key || state.sectionKey !== activeSection.key) {
            state.chapterKey = activeChapter.key;
            state.sectionKey = activeSection.key;
            renderOutline();
        }
    }

    function getProjectInput(): ProofWorkspaceProjectInput | null {
        if (!state.myManual || !state.referenceManual || !state.comparison) return null;
        return {
            myFile: state.myManual.sourceFile,
            referenceFile: state.referenceManual.sourceFile,
            myRange: pdfRange("my"),
            referenceRange: pdfRange("reference"),
            comparison: state.comparison,
            decisions: state.decisions,
            view: {
                filter: state.filter,
                query: state.query,
                selectedId: state.selectedId,
                expandedChapterKey: state.chapterKey,
                onlyIncluded: state.onlyIncluded,
                scrollTop: element("eventNavigation").scrollTop
            }
        };
    }

    async function restoreProject(result: ProofProjectReadResult): Promise<void> {
        setMessage("正在重建两本手册，请稍候。", "info");
        const [myManual, referenceManual] = await Promise.all([
            ManualReader.readManual(result.myFile, "my", result.state.manuals.my.range),
            ManualReader.readManual(result.referenceFile, "reference", result.state.manuals.reference.range)
        ]);
        validateRestoredComparison(result.state.comparison, myManual, referenceManual);
        stopWorker();
        state.myManual = myManual;
        state.referenceManual = referenceManual;
        state.comparison = result.state.comparison;
        state.decisions = Decisions.normalize(state.comparison.events, result.state.decisions);
        state.filter = result.state.view.filter || "all";
        state.query = result.state.view.query || "";
        state.selectedId = result.state.view.selectedId || "";
        state.chapterKey = result.state.view.expandedChapterKey || "";
        state.sectionKey = "";
        state.onlyIncluded = result.state.view.onlyIncluded === true;
        input("myStartPage").value = String(result.state.manuals.my.range.startPage || "");
        input("myEndPage").value = String(result.state.manuals.my.range.endPage || "");
        input("referenceStartPage").value = String(result.state.manuals.reference.range.startPage || "");
        input("referenceEndPage").value = String(result.state.manuals.reference.range.endPage || "");
        input("eventSearch").value = state.query;
        input("onlyIncluded").checked = state.onlyIncluded;
        applyFilter();
        element("eventNavigation").scrollTop = Number(result.state.view.scrollTop) || 0;
        state.dirty = false;
        renderState();
        if (state.selectedId) await renderSelection();
        else await Promise.all([showInitialManual(myManual), showInitialManual(referenceManual)]);
        setMessage(`项目已恢复：${state.comparison.events.length} 个修订事件，${Decisions.summarize(state.comparison.events, state.decisions).included} 个已纳入报告。`, "success");
    }

    function validateRestoredComparison(comparison: ManualComparison, myManual: LocalManual, referenceManual: LocalManual): void {
        if (!Array.isArray(comparison?.events) || !comparison.summary) throw new Error("项目缺少有效比较结果。");
        const ids = new Set<string>();
        comparison.events.forEach((event) => {
            if (!event?.id || ids.has(event.id)) throw new Error("项目中的修订事件编号无效或重复。");
            ids.add(event.id);
        });
        if (comparison.summary.myManualName !== myManual.name || comparison.summary.referenceManualName !== referenceManual.name) {
            throw new Error("项目比较结果与原始手册名称不一致。");
        }
    }

    function markDirty(): void {
        state.dirty = true;
        const status = document.getElementById("projectStatus");
        if (status) {
            status.textContent = "有未保存更改";
            status.className = "project-status dirty";
        }
    }

    function markProjectSaved(): void {
        state.dirty = false;
        renderState();
    }

    function pdfRange(role: ManualRole): { startPage: number | ""; endPage: number | "" } {
        const prefix = role === "my" ? "my" : "reference";
        const start = Number(input(`${prefix}StartPage`).value);
        const end = Number(input(`${prefix}EndPage`).value);
        return {
            startPage: Number.isFinite(start) && start > 0 ? Math.trunc(start) : "",
            endPage: Number.isFinite(end) && end > 0 ? Math.trunc(end) : ""
        };
    }

    function clearComparison(): void {
        stopWorker();
        state.comparison = null;
        state.outline = [];
        state.visibleEvents = [];
        state.selectedId = "";
        state.chapterKey = "";
        state.sectionKey = "";
        state.decisions = {};
        state.onlyIncluded = false;
        state.previewRequestId += 1;
    }

    function stopWorker(): void {
        state.worker?.terminate();
        state.worker = null;
    }

    async function safely(action: () => Promise<void>): Promise<void> {
        try {
            await action();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error), "danger");
        }
    }

    function setMessage(message: string, tone: "secondary" | "info" | "success" | "danger"): void {
        const target = element("workspaceMessage");
        target.className = `alert alert-${tone} py-2 mb-3`;
        target.textContent = message;
    }

    function element(id: string): HTMLElement {
        const value = document.getElementById(id);
        if (!value) throw new Error(`页面缺少 ${id}。`);
        return value;
    }

    function input(id: string): HTMLInputElement {
        return element(id) as HTMLInputElement;
    }

    function button(id: string): HTMLButtonElement {
        return element(id) as HTMLButtonElement;
    }

    function escapeHtml(value: unknown): string {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    return { bind, state };
}
