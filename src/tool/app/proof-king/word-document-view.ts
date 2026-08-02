import type { LocalManual } from "./models";

    class WordReaderView {
        private manualId = "";
        private unitElements = new Map<string, HTMLElement>();
        private focusRequestId = 0;

        constructor(private readonly container: HTMLElement) {}

        show(manual: LocalManual, focusUnitIds: string[]): void {
            if (manual.format !== "docx") {
                this.container.innerHTML = '<div class="preview-empty">当前一侧不是 Word 文档。</div>';
                this.manualId = "";
                this.unitElements.clear();
                return;
            }
            if (this.manualId !== manual.id) this.renderManual(manual);
            const requestId = ++this.focusRequestId;
            this.container.querySelectorAll(".word-unit-focus").forEach((element) => element.classList.remove("word-unit-focus"));
            const focused = focusUnitIds.map((id) => this.unitElements.get(id)).filter(Boolean) as HTMLElement[];
            focused.forEach((element) => element.classList.add("word-unit-focus"));
            const firstFocused = focused[0];
            if (!firstFocused) return;
            requestAnimationFrame(() => {
                if (requestId !== this.focusRequestId || !firstFocused.classList.contains("word-unit-focus")) return;
                this.container.scrollTop = Math.max(0, firstFocused.offsetTop - this.container.clientHeight / 2);
                requestAnimationFrame(() => this.centerFocusedUnit(firstFocused, requestId));
            });
        }

        private centerFocusedUnit(firstFocused: HTMLElement, requestId: number): void {
            if (requestId !== this.focusRequestId || !firstFocused.classList.contains("word-unit-focus")) return;
            const containerRect = this.container.getBoundingClientRect();
            const targetRect = firstFocused.getBoundingClientRect();
            const top = calculateCenteredScrollTop(
                this.container.scrollTop,
                containerRect.top,
                this.container.clientHeight,
                targetRect.top,
                targetRect.height
            );
            this.container.scrollTo({ top, behavior: "smooth" });
        }

        private renderManual(manual: LocalManual): void {
            this.manualId = manual.id;
            this.unitElements.clear();
            const fragment = document.createDocumentFragment();
            const paper = document.createElement("div");
            paper.className = "word-reader-paper";
            manual.units.forEach((unit) => {
                const element = document.createElement(unit.kind === "table-row" ? "div" : "p");
                element.className = unit.kind === "table-row" ? "word-unit word-table-row" : "word-unit";
                if (unit.text === unit.title && unit.text.length <= 40) element.classList.add("word-heading");
                element.dataset.unitId = unit.id;
                element.textContent = unit.text;
                this.unitElements.set(unit.id, element);
                paper.appendChild(element);
            });
            fragment.appendChild(paper);
            this.container.replaceChildren(fragment);
            this.container.scrollTop = 0;
        }
    }

    function calculateCenteredScrollTop(
        currentScrollTop: number,
        containerTop: number,
        containerHeight: number,
        targetTop: number,
        targetHeight: number
    ): number {
        const targetOffset = targetTop - containerTop;
        return Math.max(0, Math.round(currentScrollTop + targetOffset - (containerHeight - targetHeight) / 2));
    }

export { WordReaderView, calculateCenteredScrollTop };
