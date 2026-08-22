import "../../support-shell";
import type {
    BeginnerTutorialData,
    TutorialModule,
    TutorialNavigationOrigin,
    TutorialRecord
} from "./types";
import { isBeginnerTutorialData } from "./data-validation";
import {
    buildBeginnerTutorialMarkdown,
    downloadBeginnerTutorialMarkdown
} from "./markdown-export";
import {
    createTutorialNavigationTransition,
    encodeTutorialHash,
    readTutorialOrigin,
    resolveTutorialHash
} from "./navigation";
import {
    recordSearchText,
    renderModule,
    renderNavigation,
    renderSearchResults
} from "./render";

const dataUrl = "../../beginner-tutorial-data.json";
const navigation = document.getElementById("tutorialNavigation");
const content = document.getElementById("tutorialContent");
const searchInput = document.getElementById("tutorialSearch");
const searchStatus = document.getElementById("tutorialSearchStatus");
const exportMarkdownButton = document.getElementById("exportMarkdownButton");

let tutorialData: BeginnerTutorialData | null = null;
let activeModuleId = "";

void initialize();

async function initialize(): Promise<void> {
    if (!(navigation instanceof HTMLElement) || !(content instanceof HTMLElement)) return;

    try {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`菜鸟教程加载失败：${response.status}`);
        const data = await response.json() as unknown;
        if (!isBeginnerTutorialData(data)) throw new Error("菜鸟教程数据格式无效。");
        tutorialData = data;
        if (exportMarkdownButton instanceof HTMLButtonElement) exportMarkdownButton.disabled = false;
        const initial = resolveTutorialHash(data, location.hash);
        activeModuleId = initial.moduleId;
        history.replaceState(
            { moduleId: initial.moduleId, recordId: initial.recordId },
            "",
            encodeTutorialHash(initial.moduleId, initial.recordId)
        );
        renderActiveModule(initial.recordId, readTutorialOrigin(history.state));
        bindInteractions();
    } catch (error: unknown) {
        content.innerHTML = `<div class="tutorial-empty">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
    }
}

function bindInteractions(): void {
    navigation?.addEventListener("click", (event) => {
        const target = event.target instanceof Element
            ? event.target.closest<HTMLButtonElement>("[data-module-id]")
            : null;
        if (!target) return;
        navigateTo(target.dataset.moduleId || activeModuleId);
    });

    content?.addEventListener("click", (event) => {
        const backTarget = event.target instanceof Element
            ? event.target.closest<HTMLButtonElement>("[data-history-back]")
            : null;
        if (backTarget) {
            history.back();
            return;
        }
        const target = event.target instanceof Element
            ? event.target.closest<HTMLButtonElement>("[data-target-module][data-target-record]")
            : null;
        if (!target) return;
        const origin = target.dataset.originModule && target.dataset.originRecord && target.dataset.originTitle
            ? {
                moduleId: target.dataset.originModule,
                recordId: target.dataset.originRecord,
                title: target.dataset.originTitle
            }
            : undefined;
        navigateTo(target.dataset.targetModule || activeModuleId, target.dataset.targetRecord, origin);
    });

    searchInput?.addEventListener("input", () => {
        if (!(searchInput instanceof HTMLInputElement) || !tutorialData || !(content instanceof HTMLElement)) return;
        const query = searchInput.value.trim();
        if (!query) {
            renderActiveModule();
            return;
        }
        const matches: Array<{ module: TutorialModule; record: TutorialRecord }> = [];
        const normalizedQuery = query.toLocaleLowerCase("zh-CN");
        for (const module of tutorialData.modules) {
            for (const record of module.records || []) {
                if (recordSearchText(module, record).includes(normalizedQuery)) matches.push({ module, record });
            }
        }
        updateSearchStatus(`找到 ${matches.length} 项`);
        content.innerHTML = renderSearchResults(query, matches);
    });

    exportMarkdownButton?.addEventListener("click", () => {
        if (!tutorialData) return;
        const markdown = buildBeginnerTutorialMarkdown(tutorialData);
        downloadBeginnerTutorialMarkdown(markdown);
        updateSearchStatus("Markdown 已导出");
    });

    window.addEventListener("popstate", () => {
        if (!tutorialData) return;
        const target = resolveTutorialHash(tutorialData, location.hash);
        activeModuleId = target.moduleId;
        renderActiveModule(target.recordId, readTutorialOrigin(history.state));
    });
}

function navigateTo(moduleId: string, recordId?: string, origin?: TutorialNavigationOrigin): void {
    if (!tutorialData) return;
    if (!tutorialData.modules.some((module) => module.id === moduleId)) return;
    activeModuleId = moduleId;
    if (searchInput instanceof HTMLInputElement) searchInput.value = "";
    const transition = createTutorialNavigationTransition(moduleId, recordId, origin);
    if (transition.source) history.replaceState(transition.source.state, "", transition.source.hash);
    history.pushState(transition.target.state, "", transition.target.hash);
    renderActiveModule(recordId, origin);
}

function renderActiveModule(recordId?: string, origin?: TutorialNavigationOrigin): void {
    if (!(content instanceof HTMLElement) || !(navigation instanceof HTMLElement) || !tutorialData) return;
    const module = tutorialData.modules.find((candidate) => candidate.id === activeModuleId) || tutorialData.modules[0];
    if (!module) {
        content.innerHTML = '<div class="tutorial-empty">暂无教程内容。</div>';
        return;
    }

    activeModuleId = module.id;
    navigation.innerHTML = renderNavigation(tutorialData, activeModuleId);
    content.innerHTML = renderModule(module, origin);
    updateSearchStatus("");
    if (recordId) revealRecord(recordId);
}

function revealRecord(recordId: string): void {
    requestAnimationFrame(() => {
        const target = document.getElementById(`record-${recordId}`);
        if (!target) return;
        if (target instanceof HTMLDetailsElement) target.open = true;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        target.classList.add("is-targeted");
        window.setTimeout(() => target.classList.remove("is-targeted"), 1600);
    });
}

function updateSearchStatus(value: string): void {
    if (searchStatus instanceof HTMLElement) searchStatus.textContent = value;
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
