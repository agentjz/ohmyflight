import type { ManualItem } from "./models";

interface DocumentLibraryOptions {
    dataUrl: string;
    loadErrorLabel: string;
    invalidDataMessage: string;
    emptyMessage: string;
    downloadFileName: string;
    itemIdPrefix: string;
    listElementId?: string;
    downloadButtonId?: string;
}

export async function initializeDocumentLibrary(options: DocumentLibraryOptions): Promise<void> {
    const list = document.getElementById(options.listElementId || "manualList");
    const downloadButton = document.getElementById(options.downloadButtonId || "downloadManuals");
    if (!(list instanceof HTMLElement)) return;

    try {
        const items = await loadDocumentItems(options);
        renderDocumentItems(list, items, options.itemIdPrefix, options.emptyMessage);
        bindDownload(downloadButton, items, options.downloadFileName);
    } catch (error: unknown) {
        list.innerHTML = `<div class="empty-row">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
        if (downloadButton instanceof HTMLButtonElement) downloadButton.disabled = true;
    }
}

async function loadDocumentItems(options: DocumentLibraryOptions): Promise<ManualItem[]> {
    const response = await fetch(options.dataUrl);
    if (!response.ok) throw new Error(`${options.loadErrorLabel}：${response.status}`);
    const data = await response.json() as unknown;
    if (!Array.isArray(data) || !data.every(isDocumentItem)) throw new Error(options.invalidDataMessage);
    return data;
}

function isDocumentItem(value: unknown): value is ManualItem {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.name === "string"
        && typeof candidate.description === "string"
        && typeof candidate.source === "string"
        && typeof candidate.path === "string";
}

function renderDocumentItems(container: HTMLElement, items: ManualItem[], itemIdPrefix: string, emptyMessage: string): void {
    if (!items.length) {
        container.innerHTML = `<div class="empty-row">${escapeHtml(emptyMessage)}</div>`;
        return;
    }

    container.innerHTML = items.map((item, index) => `
        <div class="skill-item">
            <button class="skill-toggle collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#${itemIdPrefix}${index}"
                aria-expanded="false"
                aria-controls="${itemIdPrefix}${index}">
                <span class="skill-summary-copy">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.description)}</span>
                </span>
                <span class="skill-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>
                </span>
            </button>
            <div class="collapse document-collapse" id="${itemIdPrefix}${index}" data-document-index="${index}">
                <div class="skill-body">
                    <article class="skill-markdown"></article>
                </div>
            </div>
        </div>
    `).join("");

    container.addEventListener("show.bs.collapse", (event) => {
        const collapse = event.target;
        if (!(collapse instanceof HTMLElement) || !collapse.classList.contains("document-collapse") || collapse.dataset.loaded === "true") return;
        const item = items[Number(collapse.dataset.documentIndex)];
        const article = collapse.querySelector(".skill-markdown");
        if (!item || !(article instanceof HTMLElement)) return;
        article.innerHTML = marked.parse(item.source);
        resolveDocumentLinks(article, item.path);
        collapse.dataset.loaded = "true";
    });
}

function resolveDocumentLinks(container: HTMLElement, sourcePath: string): void {
    const githubSource = `https://github.com/luckymaomi/watchdog/blob/master/${sourcePath}`;
    const rawSource = `https://raw.githubusercontent.com/luckymaomi/watchdog/master/${sourcePath}`;

    container.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (href.startsWith("#")) return;
        if (!/^(?:https?:|mailto:)/i.test(href)) link.href = new URL(href, githubSource).href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
    });
    container.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
        const src = image.getAttribute("src") || "";
        if (/^(?:https?:|data:)/i.test(src)) return;
        image.src = new URL(src, rawSource).href;
    });
}

function bindDownload(button: HTMLElement | null, items: ManualItem[], fileName: string): void {
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = items.length === 0;
    button.addEventListener("click", () => downloadDocuments(items, fileName));
}

function downloadDocuments(items: ManualItem[], fileName: string): void {
    const source = items.map((item) => item.source.trim()).join("\n\n---\n\n") + "\n";
    const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
