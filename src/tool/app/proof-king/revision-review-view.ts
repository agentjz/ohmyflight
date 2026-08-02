import { ManualProofDocumentContext } from "./document-context";
import type {
    DiffSegment,
    LocalManual,
    ManualRole,
    ManualUnit,
    RevisionContextAnchor,
    RevisionEvent
} from "./models";
import { ManualProofNavigation } from "./navigation";
import { PdfDocumentView } from "./pdf-document-view";
import { WordReaderView } from "./word-document-view";

    class RevisionReviewView {
        private readonly myWordView: WordReaderView;
        private readonly referenceWordView: WordReaderView;
        private readonly myPdfView: PdfDocumentView;
        private readonly referencePdfView: PdfDocumentView;

        constructor() {
            this.myWordView = new WordReaderView(element("mySource"));
            this.referenceWordView = new WordReaderView(element("referenceSource"));
            this.myPdfView = new PdfDocumentView(element("mySource"));
            this.referencePdfView = new PdfDocumentView(element("referenceSource"));
        }

        async showInitial(manual: LocalManual): Promise<void> {
            const wordView = manual.role === "my" ? this.myWordView : this.referenceWordView;
            const pdfView = manual.role === "my" ? this.myPdfView : this.referencePdfView;
            if (manual.format === "docx") wordView.show(manual, []);
            else await pdfView.show(manual, manual.units.slice(0, 1), "完成比对后按差异定位 PDF 原页。 ");
        }

        async show(event: RevisionEvent, myManual: LocalManual, referenceManual: LocalManual): Promise<void> {
            element("selectionTitle").textContent = `${ManualProofNavigation.label(event.kind)} / ${event.title}`;
            element("selectionReason").textContent = event.reason;
            element("myChangeLocation").textContent = selectionLocation(myManual, event, "my");
            element("referenceChangeLocation").textContent = selectionLocation(referenceManual, event, "reference");
            element("myChangeText").innerHTML = renderEventContext(myManual, event, "my");
            element("referenceChangeText").innerHTML = renderEventContext(referenceManual, event, "reference");
            element("tokenChanges").textContent = tokenDescription(event);
            await Promise.all([
                showSource(myManual, unitsFor(myManual, focusUnitIds(event, "my")), this.myWordView, this.myPdfView, "该修订事件在我的手册中没有对应原文。 "),
                showSource(referenceManual, unitsFor(referenceManual, focusUnitIds(event, "reference")), this.referenceWordView, this.referencePdfView, "该修订事件在参考手册中没有对应原文。 ")
            ]);
        }

        empty(): void {
            element("selectionTitle").textContent = "选择一项修订事件";
            element("selectionReason").textContent = "新增和删除排在前面；一致内容默认不进入待办。";
            element("myChangeLocation").textContent = "";
            element("referenceChangeLocation").textContent = "";
            element("myChangeText").innerHTML = '<span class="missing-text">等待选择</span>';
            element("referenceChangeText").innerHTML = '<span class="missing-text">等待选择</span>';
            element("tokenChanges").textContent = "";
        }
    }

    async function showSource(
        manual: LocalManual,
        units: ManualUnit[],
        wordView: WordReaderView,
        pdfView: PdfDocumentView,
        emptyMessage: string
    ): Promise<void> {
        if (manual.format === "docx") {
            pdfView.reset();
            wordView.show(manual, units.map((unit) => unit.id));
        } else await pdfView.show(manual, units, emptyMessage);
    }

    function unitsFor(manual: LocalManual, ids: string[]): ManualUnit[] {
        const idSet = new Set(ids);
        return manual.units.filter((unit) => idSet.has(unit.id));
    }

    function renderDiff(segments: DiffSegment[]): string {
        return segments.map((segment) => `<span class="diff-${segment.kind}">${escapeHtml(segment.text)}</span>`).join("");
    }

    function renderEventContext(manual: LocalManual, event: RevisionEvent, role: ManualRole): string {
        const eventText = role === "my" ? event.myText : event.referenceText;
        const difference = role === "my" ? event.myDiff : event.referenceDiff;
        const unitIds = role === "my" ? event.myUnitIds : event.referenceUnitIds;
        if (event.contextAnchors.length && (event.kind === "reference-added" || event.kind === "reference-removed")) {
            return renderAnchoredContext(event, role, eventText, difference);
        }
        if (!eventText) return '<span class="missing-text">无对应原文</span>';
        const context = ManualProofDocumentContext.buildContextWindow(manual, unitIds, eventText);
        if (!context) return `<span class="context-focus">${renderDiff(difference)}</span>`;
        return [
            `<span class="context-neighbor">${escapeHtml(context.before)}</span>`,
            `<span class="context-focus">${renderDiff(difference)}</span>`,
            `<span class="context-neighbor">${escapeHtml(context.after)}</span>`
        ].join("");
    }

    function renderAnchoredContext(event: RevisionEvent, role: ManualRole, eventText: string, difference: DiffSegment[]): string {
        const before = event.contextAnchors.find((anchor) => anchor.position === "before");
        const after = event.contextAnchors.find((anchor) => anchor.position === "after");
        const anchorText = (anchor: RevisionContextAnchor) => role === "my" ? anchor.myText : anchor.referenceText;
        const blocks: string[] = [];
        blocks.push(before
            ? contextBlock("共同前文", anchorText(before), "context-anchor")
            : contextBlock("共同前文", "文档开头或前方没有可靠共同锚点", "context-missing"));
        blocks.push(eventText
            ? `<span class="context-block context-focus">${renderDiff(difference)}</span>`
            : contextBlock("对应位置", event.kind === "reference-added" ? "参考手册在此处新增内容" : "参考手册在此处删除内容", "context-insertion"));
        blocks.push(after
            ? contextBlock("共同后文", anchorText(after), "context-anchor")
            : contextBlock("共同后文", "文档结尾或后方没有可靠共同锚点", "context-missing"));
        return blocks.join("");
    }

    function contextBlock(label: string, value: string, className: string): string {
        return `<span class="context-block ${className}"><span class="context-block-label">${escapeHtml(label)}</span>${escapeHtml(value)}</span>`;
    }

    function focusUnitIds(event: RevisionEvent, role: ManualRole): string[] {
        const eventUnitIds = role === "my" ? event.myUnitIds : event.referenceUnitIds;
        if (eventUnitIds.length) return eventUnitIds;
        return Array.from(new Set(event.contextAnchors.map((anchor) => role === "my" ? anchor.myUnitId : anchor.referenceUnitId)));
    }

    function selectionLocation(manual: LocalManual, event: RevisionEvent, role: ManualRole): string {
        const eventLocation = role === "my" ? event.myLocation : event.referenceLocation;
        if (eventLocation !== "无对应原文") return eventLocation;
        const contextUnits = unitsFor(manual, focusUnitIds(event, role));
        if (!contextUnits.length) return eventLocation;
        const describe = (unit: ManualUnit) => unit.pageNumber ? `第 ${unit.pageNumber} 页` : `第 ${unit.index} 段`;
        const first = describe(contextUnits[0]);
        const last = describe(contextUnits[contextUnits.length - 1]);
        return `对应位置附近：${first === last ? first : `${first} - ${last}`}`;
    }

    function tokenDescription(event: RevisionEvent): string {
        const parts: string[] = [];
        if (event.myTokensOnly.length) parts.push(`我的手册独有：${event.myTokensOnly.join("、")}`);
        if (event.referenceTokensOnly.length) parts.push(`参考手册独有：${event.referenceTokensOnly.join("、")}`);
        return parts.join("；");
    }

    function element(id: string): HTMLElement {
        const value = document.getElementById(id);
        if (!value) throw new Error(`页面缺少 ${id}。`);
        return value;
    }

    function escapeHtml(value: unknown): string {
        return String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[character] || character));
    }

export { RevisionReviewView };
