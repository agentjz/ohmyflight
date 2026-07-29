const allToolRows: ToolItem[] = Array.isArray(tools) ? tools : [];
const categoryLabels: Record<ToolCategory, string> = {
    heavy: "重型",
    light: "轻型",
    automation: "自动化"
};

const searchInput = document.getElementById("searchInput");
const toolGrid = document.getElementById("toolGrid");
const emptyState = document.getElementById("emptyState");
const categorySwitch = document.getElementById("categorySwitch");
const announcementBanner = document.getElementById("announcementBanner");
const announcementMessage = document.getElementById("announcementMessage");
const announcementLink = document.getElementById("announcementLink");
const announcementCta = document.getElementById("announcementCta");
type HomepageCategory = ToolCategory | "all";

const configuredDefaultCategory = categorySwitch instanceof HTMLElement
    ? categorySwitch.dataset.defaultCategory
    : undefined;
let activeCategory: HomepageCategory = isHomepageCategory(configuredDefaultCategory)
    ? configuredDefaultCategory
    : "all";

renderAnnouncement();

if (
    searchInput instanceof HTMLInputElement
    && toolGrid instanceof HTMLElement
    && emptyState instanceof HTMLElement
) {
    renderCategoryCounts();
    renderCurrentView();
    bindSearch(searchInput);
    bindCategorySwitch();
    bindSearchShortcut(searchInput);
}

function bindSearch(input: HTMLInputElement): void {
    input.addEventListener("input", applyFilters);
}

function renderAnnouncement(): void {
    if (
        !(announcementBanner instanceof HTMLElement)
        || !(announcementMessage instanceof HTMLElement)
        || typeof announcement !== "object"
        || siteVisibility.homepage.announcement !== true
    ) return;

    announcementMessage.textContent = announcement.message;
    const sponsorLinkEnabled = siteVisibility.homepage.sponsorEntry === true && Boolean(announcement.href);
    if (announcementLink instanceof HTMLAnchorElement) {
        announcementLink.classList.toggle("is-clickable", sponsorLinkEnabled);
        if (sponsorLinkEnabled && announcement.href) {
            announcementLink.href = announcement.href;
            announcementLink.target = "_blank";
            announcementLink.rel = "noopener noreferrer";
        } else {
            announcementLink.removeAttribute("href");
            announcementLink.removeAttribute("target");
            announcementLink.removeAttribute("rel");
        }
    }
    if (announcementCta instanceof HTMLElement) announcementCta.hidden = !sponsorLinkEnabled;
    announcementBanner.hidden = false;
}

function renderToolCards(rows: ToolItem[]): void {
    if (!(toolGrid instanceof HTMLElement) || !(emptyState instanceof HTMLElement)) return;

    toolGrid.innerHTML = rows
        .map((item) => renderToolCard(item))
        .join("");

    emptyState.hidden = rows.length > 0;
}

function renderToolCard(item: ToolItem): string {
    return `
        <a class="tool-card"
            href="${escapeHtml(resolveToolUrl(item))}"
            target="_blank"
            rel="noopener noreferrer">
            <span class="tool-name">${escapeHtml(item.name)}</span>
            <span class="tool-desc">${escapeHtml(item.desc)}</span>
        </a>
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
    const query = searchInput.value.trim().toLowerCase();
    const rows = allToolRows.filter((item) => {
        const categoryMatches = activeCategory === "all" || item.category === activeCategory;
        const queryMatches = !query
            || `${item.name} ${item.desc} ${categoryLabels[item.category]}`.toLowerCase().includes(query);
        return categoryMatches && queryMatches;
    });
    renderToolCards(rows);
}

function renderCategoryCounts(): void {
    document.querySelectorAll<HTMLElement>("[data-category-count]").forEach((element) => {
        const category = element.dataset.categoryCount as ToolCategory | "all" | undefined;
        element.textContent = String(category === "all"
            ? allToolRows.length
            : allToolRows.filter((item) => item.category === category).length);
    });
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

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
