import { coolingGateLogic, type CoolingClickState } from "./cooling-gate-logic";
import type { ToolCategory, ToolHomepageState, ToolItem } from "./models";
import { tools } from "./tools-data";

const allToolRows: ToolItem[] = tools;
const categoryLabels: Record<ToolCategory, string> = {
    heavy: "重型",
    light: "轻型",
    automation: "自动化"
};
const homepageStateLabels: Record<ToolHomepageState, string> = {
    enabled: "已启用",
    beta: "Beta 测试",
    cooling: "冷却中"
};

const searchInput = document.getElementById("searchInput");
const toolList = document.getElementById("toolList");
const hiddenToolsView = document.getElementById("hiddenToolsView");
const hiddenToolList = document.getElementById("hiddenToolList");
const emptyState = document.getElementById("emptyState");
const resultToolCount = document.getElementById("resultToolCount");
const categorySwitch = document.getElementById("categorySwitch");
const homeThemeToggle = document.getElementById("homeThemeToggle");
const coolingUnlockArea = document.getElementById("coolingUnlockArea");
const coolingUnlockInput = document.getElementById("coolingUnlockInput");
const coolingUnlockStatus = document.getElementById("coolingUnlockStatus");
type HomepageCategory = ToolCategory | "all";
let coolingToolsUnlocked = false;
let coolingKeyAccepted = false;
let coolingClickState: CoolingClickState = {
    buttonKey: "",
    count: 0,
    lastClickedAt: Number.NEGATIVE_INFINITY
};

const configuredDefaultCategory = categorySwitch instanceof HTMLElement
    ? categorySwitch.dataset.defaultCategory
    : undefined;
let activeCategory: HomepageCategory = isHomepageCategory(configuredDefaultCategory)
    ? configuredDefaultCategory
    : "all";

bindHomeThemeToggle();

if (
    searchInput instanceof HTMLInputElement
    && toolList instanceof HTMLElement
    && hiddenToolList instanceof HTMLElement
    && emptyState instanceof HTMLElement
) {
    renderCategoryCounts();
    renderCurrentView();
    bindSearch(searchInput);
    bindCategorySwitch();
    bindSearchShortcut(searchInput);
    bindCoolingUnlock();
}

function bindSearch(input: HTMLInputElement): void {
    input.addEventListener("input", applyFilters);
}

function bindHomeThemeToggle(): void {
    if (!(homeThemeToggle instanceof HTMLButtonElement) || !window.WatchdogTheme) return;

    const syncToggle = (): void => {
        const isDark = window.WatchdogTheme?.getTheme() === "dark";
        const label = isDark ? "切换到白天模式" : "切换到暗夜模式";
        homeThemeToggle.setAttribute("aria-label", label);
        homeThemeToggle.setAttribute("aria-pressed", String(isDark));
        homeThemeToggle.title = label;
    };

    homeThemeToggle.addEventListener("click", () => {
        window.WatchdogTheme?.toggleTheme();
    });
    window.addEventListener("watchdog:themechange", syncToggle);
    syncToggle();
}

function renderToolList(rows: ToolItem[]): void {
    if (!(toolList instanceof HTMLElement)) return;

    toolList.innerHTML = rows
        .map((item) => renderToolListItem(item))
        .join("");
}

function renderHiddenToolList(rows: ToolItem[]): void {
    if (!(hiddenToolsView instanceof HTMLElement) || !(hiddenToolList instanceof HTMLElement)) return;
    hiddenToolList.innerHTML = rows.map((item) => renderToolListItem(item)).join("");
    hiddenToolsView.hidden = !coolingToolsUnlocked || rows.length === 0;
}

function renderToolListItem(item: ToolItem): string {
    const state = item.homepageState || "enabled";
    const stateLabel = homepageStateLabels[state];
    const content = `
        <div class="tool-card-heading">
            <div>
                <h2 class="tool-card-title">${escapeHtml(item.name)}</h2>
                <span class="tool-state-label">${escapeHtml(stateLabel)}</span>
            </div>
            <span class="tool-status-switch" role="img" aria-label="首页入口${escapeHtml(stateLabel)}">
                <span aria-hidden="true"></span>
            </span>
        </div>
        <p class="tool-desc">${escapeHtml(item.desc)}</p>
    `;
    return `
        <article class="tool-card is-${escapeHtml(state)} is-enabled">
            <a class="tool-card-surface" href="${escapeHtml(resolveToolUrl(item))}" target="_blank" rel="noopener noreferrer">${content}</a>
            <a
                class="tool-card-download"
                href="${escapeHtml(resolveToolExportUrl(item))}"
                download
                aria-label="下载${escapeHtml(item.name)}独立应用"
                title="下载${escapeHtml(item.name)}独立应用"
            >
                <svg class="bi bi-file-earmark-arrow-down tool-download-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
                    <path d="M8 5a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 1 1 .708-.708L7.5 9.293V5.5A.5.5 0 0 1 8 5Z"/>
                    <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM9.5 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5h-2a1.5 1.5 0 0 1-1.5-1.5V1Zm1 0v2.5a.5.5 0 0 0 .5.5h2.5l-3-3Z"/>
                </svg>
            </a>
        </article>
    `;
}

function applyFilters(): void {
    if (!(searchInput instanceof HTMLInputElement)) return;
    renderCurrentView();
}

function renderCurrentView(): void {
    if (
        !(searchInput instanceof HTMLInputElement)
        || !(emptyState instanceof HTMLElement)
    ) return;

    syncCategoryButtons();
    const rows = filterToolRows(getVisibleToolRows());
    const hiddenRows = coolingToolsUnlocked ? filterToolRows(getHiddenToolRows()) : [];
    renderHiddenToolList(hiddenRows);
    const allRenderedRows = [...rows, ...hiddenRows];
    renderToolList(rows);
    if (emptyState instanceof HTMLElement) emptyState.hidden = allRenderedRows.length > 0;
    if (resultToolCount instanceof HTMLElement) resultToolCount.textContent = `${allRenderedRows.length} 项`;
}

function filterToolRows(sourceRows: ToolItem[]): ToolItem[] {
    if (!(searchInput instanceof HTMLInputElement)) return [];
    const query = searchInput.value.trim().toLowerCase();
    return sourceRows.filter((item) => {
        const categoryMatches = activeCategory === "all" || item.category === activeCategory;
        const queryMatches = !query
            || `${item.name} ${item.desc} ${categoryLabels[item.category]}`.toLowerCase().includes(query);
        return categoryMatches && queryMatches;
    });
}

function renderCategoryCounts(): void {
    const countedToolRows = coolingToolsUnlocked ? allToolRows : getVisibleToolRows();
    document.querySelectorAll<HTMLElement>("[data-category-count]").forEach((element) => {
        const category = element.dataset.categoryCount as ToolCategory | "all" | undefined;
        element.textContent = String(category === "all"
            ? countedToolRows.length
            : countedToolRows.filter((item) => item.category === category).length);
    });
}

function getVisibleToolRows(): ToolItem[] {
    return allToolRows.filter((item) => !isHiddenTool(item));
}

function getHiddenToolRows(): ToolItem[] {
    return allToolRows.filter((item) => isHiddenTool(item));
}

function isHiddenTool(item: ToolItem): boolean {
    return coolingGateLogic.isHomepageToolHidden(item.homepageState, item.homepageVisibility);
}

function bindCoolingUnlock(): void {
    if (
        !(coolingUnlockArea instanceof HTMLElement)
        || !(coolingUnlockInput instanceof HTMLInputElement)
        || !(categorySwitch instanceof HTMLElement)
    ) return;
    const allCategoryButton = categorySwitch.querySelector<HTMLButtonElement>('[data-category="all"]');
    if (!allCategoryButton) return;

    coolingUnlockInput.addEventListener("input", () => {
        const accepted = coolingGateLogic.matches(coolingUnlockInput.value);
        if (accepted === coolingKeyAccepted) return;
        coolingKeyAccepted = accepted;
        resetCoolingClicks();
        showCoolingUnlockStatus(accepted ? "口令已接收" : "");
    });

    allCategoryButton.addEventListener("click", () => {
        if (!coolingKeyAccepted || !coolingGateLogic.matches(coolingUnlockInput.value)) {
            return;
        }

        const result = coolingGateLogic.registerClick(
            coolingClickState,
            "category-all",
            Date.now()
        );
        coolingClickState = result.state;
        if (!result.matched) return;

        coolingToolsUnlocked = true;
        coolingKeyAccepted = false;
        coolingUnlockInput.classList.add("is-unlocked");
        coolingUnlockArea.hidden = true;
        showCoolingUnlockStatus("已显示隐藏工具");
        renderCategoryCounts();
        renderCurrentView();
    });
}

function resetCoolingClicks(): void {
    coolingClickState = {
        buttonKey: "",
        count: 0,
        lastClickedAt: Number.NEGATIVE_INFINITY
    };
}

function showCoolingUnlockStatus(message: string): void {
    if (coolingUnlockStatus instanceof HTMLElement) coolingUnlockStatus.textContent = message;
}

function bindCategorySwitch(): void {
    if (!(categorySwitch instanceof HTMLElement)) return;
    categorySwitch.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const button = target.closest<HTMLButtonElement>("[data-category]");
        if (!button) return;
        const category = button.dataset.category;
        if (!isHomepageCategory(category)) return;

        activeCategory = category;
        renderCurrentView();
    });
}

function isToolCategory(value: unknown): value is ToolCategory {
    return value === "heavy" || value === "light" || value === "automation";
}

function isHomepageCategory(value: unknown): value is HomepageCategory {
    return value === "all" || isToolCategory(value);
}

function syncCategoryButtons(): void {
    if (!(categorySwitch instanceof HTMLElement)) return;
    categorySwitch.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((candidate) => {
        const isActive = candidate.dataset.category === activeCategory;
        candidate.classList.toggle("active", isActive);
        candidate.setAttribute("aria-pressed", String(isActive));
    });
}

function bindSearchShortcut(input: HTMLInputElement): void {
    document.addEventListener("keydown", (event) => {
        if (event.key === "/" && document.activeElement !== input) {
            const active = document.activeElement;
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
            event.preventDefault();
            input.focus();
            return;
        }

        if (event.key === "Escape" && document.activeElement === input) {
            input.value = "";
            input.blur();
            applyFilters();
        }
    });
}

function resolveToolUrl(item: ToolItem): string {
    return `./app/${item.entry}/index.html`;
}

function resolveToolExportUrl(item: ToolItem): string {
    return `../exports/${item.entry}.zip`;
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
