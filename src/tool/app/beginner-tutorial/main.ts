import "../../support-shell";
import type { BeginnerTutorialData, TutorialModule, TutorialRecord } from "./types";
import { isBeginnerTutorialData } from "./data-validation";
import {
    buildBeginnerTutorialMarkdown,
    downloadBeginnerTutorialMarkdown
} from "./markdown-export";
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
        const initial = resolveHash(data);
        activeModuleId = initial.moduleId;
        renderActiveModule(initial.recordId);
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
        const target = event.target instanceof Element
            ? event.target.closest<HTMLButtonElement>("[data-target-module][data-target-record]")
            : null;
        if (!target) return;
        navigateTo(target.dataset.targetModule || activeModuleId, target.dataset.targetRecord);
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
}

function navigateTo(moduleId: string, recordId?: string): void {
    if (!tutorialData) return;
    if (!tutorialData.modules.some((module) => module.id === moduleId)) return;
    activeModuleId = moduleId;
    if (searchInput instanceof HTMLInputElement) searchInput.value = "";
    history.replaceState(null, "", encodeHash(moduleId, recordId));
    renderActiveModule(recordId);
}

function renderActiveModule(recordId?: string): void {
    if (!(content instanceof HTMLElement) || !(navigation instanceof HTMLElement) || !tutorialData) return;
    const module = tutorialData.modules.find((candidate) => candidate.id === activeModuleId) || tutorialData.modules[0];
    if (!module) {
        content.innerHTML = '<div class="tutorial-empty">暂无教程内容。</div>';
        return;
    }

    activeModuleId = module.id;
    navigation.innerHTML = renderNavigation(tutorialData, activeModuleId);
    content.innerHTML = renderModule(module);
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

function resolveHash(data: BeginnerTutorialData): { moduleId: string; recordId?: string } {
    const [moduleId, recordId] = decodeURIComponent(location.hash.replace(/^#/, "")).split("/");
    return data.modules.some((module) => module.id === moduleId)
        ? { moduleId, ...(recordId ? { recordId } : {}) }
        : { moduleId: data.modules[0]?.id || "" };
}

function encodeHash(moduleId: string, recordId?: string): string {
    const value = recordId ? `${moduleId}/${recordId}` : moduleId;
    return `#${encodeURIComponent(value)}`;
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
