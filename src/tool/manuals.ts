const allManualRows: ManualItem[] = Array.isArray(manuals) ? manuals : [];
const manualList = document.getElementById("manualList");
const downloadManuals = document.getElementById("downloadManuals");

if (manualList instanceof HTMLElement) {
    renderManuals(manualList);
}

if (downloadManuals instanceof HTMLButtonElement) {
    downloadManuals.disabled = allManualRows.length === 0;
    downloadManuals.addEventListener("click", downloadAllManuals);
}

function renderManuals(container: HTMLElement): void {
    if (!allManualRows.length) {
        container.innerHTML = '<div class="empty-row">暂无用户手册。</div>';
        return;
    }

    container.innerHTML = allManualRows.map((item, index) => `
        <div class="skill-item">
            <button class="skill-toggle collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#manualSource${index}"
                aria-expanded="false"
                aria-controls="manualSource${index}">
                <span class="skill-summary-copy">
                    <strong>${escapeManualHtml(item.name)}</strong>
                    <span>${escapeManualHtml(item.description)}</span>
                </span>
                <span class="skill-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>
                </span>
            </button>
            <div class="collapse manual-collapse" id="manualSource${index}" data-manual-index="${index}">
                <div class="skill-body">
                    <article class="skill-markdown"></article>
                </div>
            </div>
        </div>
    `).join("");

    container.addEventListener("show.bs.collapse", (event) => {
        const collapse = event.target;
        if (!(collapse instanceof HTMLElement) || !collapse.classList.contains("manual-collapse") || collapse.dataset.loaded === "true") return;
        const item = allManualRows[Number(collapse.dataset.manualIndex)];
        const article = collapse.querySelector(".skill-markdown");
        if (!item || !(article instanceof HTMLElement)) return;
        article.innerHTML = marked.parse(item.source);
        resolveManualLinks(article, item.path);
        collapse.dataset.loaded = "true";
    });
}

function resolveManualLinks(container: HTMLElement, sourcePath: string): void {
    const githubSource = `https://github.com/luckymaomi/ohmyflight/blob/master/${sourcePath}`;
    const rawSource = `https://raw.githubusercontent.com/luckymaomi/ohmyflight/master/${sourcePath}`;

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

function downloadAllManuals(): void {
    const source = allManualRows.map((item) => item.source.trim()).join("\n\n---\n\n") + "\n";
    const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ohmyflight-用户手册.md";
    link.click();
    URL.revokeObjectURL(url);
}

function escapeManualHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
