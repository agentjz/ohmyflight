import { ManualProofDecisions as Decisions } from "./decision-model";
import type {
    RevisionCategoryCount,
    RevisionChapterGroup,
    RevisionDecision,
    RevisionDecisionMap,
    RevisionKind,
    RevisionNavigationEvent,
    VirtualWindow
} from "./models";
import { ManualProofNavigation as Navigation } from "./navigation";

    function renderCategories(
        container: HTMLElement,
        counts: RevisionCategoryCount[],
        activeKind: RevisionKind | "all",
        hasQuery: boolean
    ): void {
        container.innerHTML = counts.map((item) => {
            const count = hasQuery && item.matched !== item.total ? `${item.matched}/${item.total}` : String(item.total);
            return `<button class="filter-button${item.kind === activeKind ? " active" : ""}" data-filter="${item.kind}" type="button">
                <span>${escapeHtml(item.label)}</span><strong>${escapeHtml(count)}</strong>
            </button>`;
        }).join("");
    }

    function renderOutline(
        navigation: HTMLElement,
        chapterCount: HTMLElement,
        sectionCount: HTMLElement,
        resultCount: HTMLElement,
        outline: RevisionChapterGroup[],
        chapterKey: string,
        sectionKey: string,
        visibleEventCount: number,
        hasComparison: boolean
    ): void {
        if (!outline.length) {
            navigation.innerHTML = hasComparison
                ? '<div class="outline-empty">当前范围没有章节。</div>'
                : '<div class="outline-empty">完成比对后显示章节。</div>';
            chapterCount.textContent = "";
            sectionCount.textContent = "";
            resultCount.textContent = "";
            return;
        }
        navigation.innerHTML = outline.map((chapter) => {
            const expanded = chapter.key === chapterKey;
            const sections = expanded ? chapter.sections.map((section) => `
                <button type="button" class="outline-section${section.key === sectionKey ? " active" : ""}"
                    data-section-key="${escapeHtml(section.key)}" data-start-event-id="${escapeHtml(section.startEventId)}">
                    <span>${escapeHtml(section.label)}</span><strong>${section.count}</strong>
                </button>
            `).join("") : "";
            return `<div class="outline-chapter">
                <button type="button" class="outline-button${expanded ? " active" : ""}"
                    data-chapter-key="${escapeHtml(chapter.key)}" aria-expanded="${expanded}">
                    <span>${escapeHtml(chapter.label)}</span><strong>${chapter.count}</strong>
                </button>
                ${expanded ? `<div class="outline-sections">${sections}</div>` : ""}
            </div>`;
        }).join("");
        chapterCount.textContent = `${outline.length} 章`;
        sectionCount.textContent = `${outline.reduce((count, chapter) => count + chapter.sections.length, 0)} 节`;
        resultCount.textContent = visibleEventCount ? `${visibleEventCount} 项` : "";
    }

    function renderEvents(
        navigation: HTMLElement,
        spacer: HTMLElement,
        visible: HTMLElement,
        events: RevisionNavigationEvent[],
        selectedId: string,
        query: string,
        decisions: RevisionDecisionMap,
        hasComparison: boolean
    ): void {
        if (!events.length) {
            spacer.style.height = "0";
            visible.innerHTML = hasComparison
                ? '<div class="navigation-empty">当前条件下没有修订事件。</div>'
                : '<div class="navigation-empty">完成比对后显示修订事件。</div>';
            return;
        }
        const range = Navigation.calculateWindow(
            navigation.scrollTop,
            navigation.clientHeight,
            events.length
        ) as VirtualWindow;
        spacer.style.height = `${range.totalHeight}px`;
        visible.style.transform = `translateY(${range.offsetTop}px)`;
        visible.innerHTML = events.slice(range.start, range.end).map((event) => {
            const decision = Decisions.get(decisions, event.id) as RevisionDecision || "pending";
            return `
            <div role="button" tabindex="0" class="event-row event-${event.kind} decision-${decision}${event.id === selectedId ? " active" : ""}" data-event-id="${escapeHtml(event.id)}">
                        <span class="event-kind">${escapeHtml(Navigation.label(event.kind))}</span>
                <strong>${escapeHtml(event.title)}</strong>
                <span class="event-decision">
                    <label class="event-include" title="勾选纳入报告；再次点击取消纳入">
                        <input type="checkbox" data-decision-toggle="${escapeHtml(event.id)}"${decision === "included" ? " checked" : ""}>
                        <span>纳入</span>
                    </label>
                    <span class="event-decision-status">${escapeHtml(decisionStatus(decision))}</span>
                </span>
                <span class="event-location">${escapeHtml(matchedSideLabel(event, query))} · ${escapeHtml(matchedLocation(event))}</span>
                <span class="event-excerpt">${highlightQuery(event.matchedExcerpt || event.referenceText || event.myText, query)}</span>
            </div>`;
        }).join("");
    }

    function matchedSideLabel(event: RevisionNavigationEvent, query: string): string {
        if (!query) {
            if (event.myText && event.referenceText) return "双侧原文";
            return event.referenceText ? "参考手册" : "我的手册";
        }
        return { title: "标题命中", my: "我的手册命中", reference: "参考手册命中", both: "双侧命中" }[event.matchedSide || "title"];
    }

    function decisionStatus(decision: RevisionDecision): string {
        return { pending: "待处理", included: "已纳入", excluded: "不纳入" }[decision];
    }

    function matchedLocation(event: RevisionNavigationEvent): string {
        if (event.matchedSide === "my") return event.myLocation;
        if (event.matchedSide === "reference") return event.referenceLocation;
        if (event.matchedSide === "both") return `${event.myLocation} / ${event.referenceLocation}`;
        return event.referenceLocation !== "无对应原文" ? event.referenceLocation : event.myLocation;
    }

    function highlightQuery(value: string, query: string): string {
        const source = String(value || "");
        if (!query) return escapeHtml(source);
        const index = source.normalize("NFKC").toLowerCase().indexOf(query.normalize("NFKC").toLowerCase());
        if (index < 0) return escapeHtml(source);
        return `${escapeHtml(source.slice(0, index))}<mark>${escapeHtml(source.slice(index, index + query.length))}</mark>${escapeHtml(source.slice(index + query.length))}`;
    }

    function escapeHtml(value: unknown): string {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

export const ManualProofRevisionNavigationView = { renderCategories, renderOutline, renderEvents };
