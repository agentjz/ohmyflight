import "./support-shell";
import type { SkillItem } from "./models";

type VersionInfo = {
    commit?: string;
    commits?: Array<{
        hash?: string;
        date?: string;
        message?: string;
    }>;
};

let allSkillRows: SkillItem[] = [];
const developerSkills = document.getElementById("developerSkills");
const commitMeta = document.getElementById("commitMeta");
const commitList = document.getElementById("commitList");
const copyToastElement = document.getElementById("copyToast");
const copyToastBody = document.getElementById("copyToastBody");

initializeSkills();
renderCommits();

async function initializeSkills(): Promise<void> {
    if (!(developerSkills instanceof HTMLElement)) return;
    try {
        const response = await fetch("./skills-data.json");
        if (!response.ok) throw new Error(`Skills 加载失败：${response.status}`);
        const data = await response.json() as unknown;
        if (!Array.isArray(data)) throw new Error("Skills 数据格式无效。");
        allSkillRows = data as SkillItem[];
        renderSkills(developerSkills);
    } catch (error) {
        developerSkills.innerHTML = `<div class="empty-row">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
    }
}

function renderSkills(container: HTMLElement): void {
    if (!allSkillRows.length) {
        container.innerHTML = '<div class="empty-row">暂无 Skills。</div>';
        return;
    }

    container.innerHTML = allSkillRows.map((item, index) => `
        <div class="skill-item">
            <button class="skill-toggle collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#skillSource${index}"
                aria-expanded="false"
                aria-controls="skillSource${index}">
                <span class="skill-summary-copy">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.description)}</span>
                </span>
                <span class="skill-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>
                </span>
            </button>
            <div class="collapse skill-collapse" id="skillSource${index}" data-skill-index="${index}">
                <div class="skill-body">
                    <div class="skill-actions">
                        <button class="support-link copy-skill" type="button" data-copy-skill="${index}">复制 Skill</button>
                    </div>
                    <article class="skill-markdown"></article>
                </div>
            </div>
        </div>
    `).join("");

    container.addEventListener("show.bs.collapse", (event) => {
        const collapse = event.target;
        if (!(collapse instanceof HTMLElement) || !collapse.classList.contains("skill-collapse") || collapse.dataset.loaded === "true") return;
        const item = allSkillRows[Number(collapse.dataset.skillIndex)];
        const article = collapse.querySelector(".skill-markdown");
        if (!item || !(article instanceof HTMLElement)) return;
        article.innerHTML = marked.parse(stripFrontmatter(item.source));
        resolveSkillLinks(article, item.path);
        collapse.dataset.loaded = "true";
    });

    container.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const button = target.closest<HTMLButtonElement>("[data-copy-skill]");
        if (!button) return;
        const item = allSkillRows[Number(button.dataset.copySkill)];
        if (!item) return;
        const copied = await copyText(item.source);
        showToast(copied ? `已复制 ${item.name}` : "复制失败，请手动选择原文");
    });
}

function stripFrontmatter(source: string): string {
    return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function resolveSkillLinks(container: HTMLElement, sourcePath: string): void {
    const githubSource = `https://github.com/luckymaomi/cargodog/blob/master/${sourcePath}`;
    const rawSource = `https://raw.githubusercontent.com/luckymaomi/cargodog/master/${sourcePath}`;

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

async function renderCommits(): Promise<void> {
    if (!(commitMeta instanceof HTMLElement) || !(commitList instanceof HTMLElement)) return;

    try {
        const response = await fetch("../version.json", { cache: "no-store" });
        if (!response.ok) throw new Error("version not found");
        const version = await response.json() as VersionInfo;
        const commits = Array.isArray(version.commits) ? version.commits : [];
        commitMeta.textContent = `${version.commit || "unknown"} · ${commits.length} 条提交`;
        commitList.innerHTML = commits.length
            ? commits.map((item) => `
                <div class="commit-item">
                    <span class="commit-date">${escapeHtml(formatCommitDate(item.date))}</span>
                    <span class="commit-hash">${escapeHtml(item.hash || "")}</span>
                    <span class="commit-message">${escapeHtml(item.message || "")}</span>
                </div>
            `).join("")
            : '<div class="empty-row">暂无提交记录。</div>';
    } catch {
        commitMeta.textContent = "";
        commitList.innerHTML = '<div class="empty-row">无法读取提交记录。</div>';
    }
}

async function copyText(value: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        const helper = document.createElement("textarea");
        helper.value = value;
        helper.readOnly = true;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand("copy");
        helper.remove();
        return copied;
    }
}

function showToast(message: string): void {
    if (!(copyToastElement instanceof HTMLElement) || !(copyToastBody instanceof HTMLElement)) return;
    copyToastBody.textContent = message;
    bootstrap.Toast.getOrCreateInstance(copyToastElement).show();
}

function formatCommitDate(value: unknown): string {
    const date = value ? new Date(String(value)) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
