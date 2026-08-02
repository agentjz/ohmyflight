import type {
    LocalManual,
    ManualProofHookConfig,
    ManualRole,
    ManualUnit,
    PdfLineRecord,
    WorkerManual
} from "./models";

type ManualReaderDependencies = {
    mammoth: { extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value?: string }> } | null;
    pdfjsLib: any;
    hooks: ManualProofHookConfig;
};

export function createManualReader(dependencies: ManualReaderDependencies) {

    function makeManualId(role: ManualRole, file: File): string {
        const name = (file.name || "manual").replace(/[^0-9a-zA-Z\u4e00-\u9fff-]+/g, "-");
        return `${role}-${name}`;
    }

    async function readManual(file: File, role: ManualRole, range: { startPage: number | ""; endPage: number | "" }): Promise<LocalManual> {
        if (/\.docx$/i.test(file.name)) return readWord(file, role);
        if (/\.pdf$/i.test(file.name)) return readPdf(file, role, range);
        throw new Error("仅支持标准 .docx 和带文字层的 .pdf。 ");
    }

    async function readWord(file: File, role: ManualRole): Promise<LocalManual> {
        if (!dependencies.mammoth?.extractRawText) throw new Error("页面缺少 Word 文字读取组件。 ");
        const id = makeManualId(role, file);
        const data = await file.arrayBuffer();
        const extracted = await dependencies.mammoth.extractRawText({ arrayBuffer: data });
        const units = splitWordUnits(extracted.value || "", id);
        if (!units.length) throw new Error(`${file.name} 未提取到可比对文字。`);
        return { id, role, name: file.name, format: "docx", units, sourceFile: file };
    }

    function splitWordUnits(value: unknown, manualId: string): ManualUnit[] {
        const units: ManualUnit[] = [];
        let currentTitle = "";
        String(value ?? "")
            .replace(/\r\n?/g, "\n")
            .split(/\n+/)
            .map((line) => line.replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .forEach((line) => {
                if (looksLikeTitle(line)) currentTitle = line;
                units.push({
                    id: `${manualId}-unit-${units.length + 1}`,
                    manualId,
                    index: units.length + 1,
                    kind: line.includes("\t") ? "table-row" : "paragraph",
                    text: line.replace(/\t+/g, " | "),
                    title: currentTitle
                });
            });
        return units;
    }

    function looksLikeTitle(value: string): boolean {
        const text = value.trim();
        if (/^\d+(?:\.\d+){1,6}(?:\s+\S.*)?$/.test(text)) return true;
        if (/^第[一二三四五六七八九十百\d]+[章节条](?:\s+\S.*)?$/.test(text)) return true;
        return text.length >= 2 && text.length <= 28 && !/[。；，！？!?：:]$/.test(text);
    }

    async function readPdf(
        file: File,
        role: ManualRole,
        requestedRange: { startPage: number | ""; endPage: number | "" }
    ): Promise<LocalManual> {
        if (!dependencies.pdfjsLib) throw new Error("页面缺少 PDF 读取组件。 ");
        dependencies.pdfjsLib.GlobalWorkerOptions.workerSrc = "../../../libs/pdf.worker.min.js";
        const id = makeManualId(role, file);
        const data = await file.arrayBuffer();
        const pdfDocument = await dependencies.pdfjsLib.getDocument({ data }).promise;
        const range = normalizePdfRange(requestedRange.startPage, requestedRange.endPage, pdfDocument.numPages);
        const pages: PdfLineRecord[][] = [];
        for (let pageNumber = range.start; pageNumber <= range.end; pageNumber += 1) {
            const page = await pdfDocument.getPage(pageNumber);
            const content = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });
            pages.push(groupPdfItemsIntoLines(content.items || [], pageNumber, viewport.height));
        }
        const units = extractPdfUnitsFromPages(pages, id);
        if (!units.length) throw new Error(`${file.name} 没有可读取文字层，暂不支持扫描件或图片 PDF。`);
        return {
            id,
            role,
            name: file.name,
            format: "pdf",
            units,
            sourceFile: file,
            pageCount: pdfDocument.numPages,
            pdfStartPage: range.start,
            pdfEndPage: range.end,
            pdfDocument
        };
    }

    function groupPdfItemsIntoLines(items: any[], pageNumber: number, pageHeight: number): PdfLineRecord[] {
        const groups = new Map<number, Array<{ text: string; x: number; width: number; y: number }>>();
        const ignoredNoiseLines = configuredIgnoredNoiseLines();
        items.forEach((item) => {
            const text = String(item?.str || "").trim();
            const transform = item?.transform || [];
            const x = Number(transform[4]);
            const y = Number(transform[5]);
            if (!text || ignoredNoiseLines.has(normalizeLine(text)) || !Number.isFinite(x) || !Number.isFinite(y)) return;
            const key = Math.round(y / 2) * 2;
            const values = groups.get(key) || [];
            values.push({ text, x, width: Number(item?.width) || 0, y });
            groups.set(key, values);
        });
        return Array.from(groups.entries())
            .sort((left, right) => right[0] - left[0])
            .map(([_key, lineItems]) => {
                lineItems.sort((left, right) => left.x - right.x);
                const text = joinPdfLineItems(lineItems);
                const first = lineItems[0];
                return {
                    pageNumber,
                    text,
                    x: first.x,
                    y: first.y,
                    topRatio: 1 - first.y / Math.max(1, pageHeight)
                };
            })
            .filter((line) => !!line.text);
    }

    function joinPdfLineItems(items: Array<{ text: string; x: number; width: number }>): string {
        let result = "";
        let previousEnd = 0;
        items.forEach((item) => {
            const needsSpace = !!result && item.x - previousEnd > 3 && /[0-9a-zA-Z]$/.test(result) && /^[0-9a-zA-Z]/.test(item.text);
            result += `${needsSpace ? " " : ""}${item.text}`;
            previousEnd = Math.max(previousEnd, item.x + item.width);
        });
        return result.replace(/\s+/g, " ").trim();
    }

    function extractPdfUnitsFromPages(pages: PdfLineRecord[][], manualId: string): ManualUnit[] {
        const repeated = repeatedMarginLines(pages);
        const ignoredNoiseLines = configuredIgnoredNoiseLines();
        const units: ManualUnit[] = [];
        let currentTitle = "";
        let paragraph = "";
        let paragraphPage: number | undefined;
        const flush = () => {
            const text = paragraph.replace(/\s+/g, " ").trim();
            paragraph = "";
            if (!text || paragraphPage === undefined) return;
            if (looksLikeTitle(text)) currentTitle = text;
            units.push({
                id: `${manualId}-unit-${units.length + 1}`,
                manualId,
                index: units.length + 1,
                kind: "pdf-paragraph",
                text,
                title: currentTitle,
                pageNumber: paragraphPage
            });
            paragraphPage = undefined;
        };
        pages.forEach((pageLines) => {
            const lines = pageLines.filter((line) => {
                const normalized = normalizeLine(line.text);
                if (!normalized) return false;
                if (ignoredNoiseLines.has(normalized)) return false;
                if (line.topRatio < 0.08 || line.topRatio > 0.9) return false;
                if (marginKeys(line.text).some((key) => repeated.has(key))) return false;
                if ((line.topRatio < 0.14 || line.topRatio > 0.88) && /^\d{1,4}$/.test(line.text.trim())) return false;
                return true;
            });
            lines.forEach((line) => {
                const value = line.text.trim();
                const clause = parseClauseLine(value);
                if (clause) {
                    flush();
                    if (clause.text && clause.text.length <= 40 && !/[。；！？!?]$/.test(clause.text)) {
                        currentTitle = `${clause.number} ${clause.text}`;
                    } else if (!currentTitle) {
                        currentTitle = clause.number;
                    }
                    if (clause.text) {
                        paragraph = clause.text;
                        paragraphPage = line.pageNumber;
                        if (/[。；！？!?]$/.test(clause.text)) flush();
                    }
                    return;
                }
                if (!paragraph) paragraphPage = line.pageNumber;
                paragraph = appendPdfLine(paragraph, value);
                if (/[。；！？!?]$/.test(value) || normalizeLine(paragraph).length >= 420) flush();
            });
            flush();
        });
        return units;
    }

    function appendPdfLine(current: string, next: string): string {
        if (!current) return next;
        const needsSpace = /[0-9a-zA-Z]$/.test(current) && /^[0-9a-zA-Z]/.test(next);
        return `${current}${needsSpace ? " " : ""}${next}`;
    }

    function repeatedMarginLines(pages: PdfLineRecord[][]): Set<string> {
        const pageIndexes = new Map<string, Set<number>>();
        pages.forEach((lines, pageIndex) => {
            lines.forEach((line) => {
                if (line.topRatio >= 0.14 && line.topRatio <= 0.88) return;
                marginKeys(line.text).forEach((key) => {
                    const indexes = pageIndexes.get(key) || new Set<number>();
                    indexes.add(pageIndex);
                    pageIndexes.set(key, indexes);
                });
            });
        });
        const threshold = Math.max(3, Math.ceil(pages.length * 0.25));
        return new Set(Array.from(pageIndexes.entries()).filter(([, indexes]) => indexes.size >= threshold).map(([text]) => text));
    }

    function marginKeys(value: string): string[] {
        const normalized = normalizeLine(value);
        if (!normalized) return [];
        const generic = normalized.replace(/\d+/g, "#");
        const keys = new Set([normalized, generic]);
        if (generic.length >= 8) keys.add(generic.slice(0, 10));
        return Array.from(keys);
    }

    function normalizeLine(value: string): string {
        return value.normalize("NFKC").toLowerCase().replace(/[^0-9a-z\u4e00-\u9fff]+/g, "");
    }

    function configuredIgnoredNoiseLines(): Set<string> {
        return new Set(
            (dependencies.hooks.ignoredNoisePhrases || [])
                .map((phrase) => normalizeLine(String(phrase)))
                .filter(Boolean)
        );
    }

    function parseClauseLine(value: string): { number: string; text: string } | null {
        const match = value.trim().match(/^((?:第[一二三四五六七八九十百\d]+[章节条]|\d+(?:\.\d+){1,6}))\s*(.*)$/);
        return match ? { number: match[1], text: match[2].trim() } : null;
    }

    function normalizePdfRange(startPage: number | "", endPage: number | "", pageCount: number): { start: number; end: number } {
        const rawStart = Number(startPage);
        const rawEnd = Number(endPage);
        const first = Number.isFinite(rawStart) && rawStart > 0 ? Math.trunc(rawStart) : 1;
        const last = Number.isFinite(rawEnd) && rawEnd > 0 ? Math.trunc(rawEnd) : pageCount;
        return {
            start: Math.max(1, Math.min(first, last, pageCount)),
            end: Math.max(1, Math.min(Math.max(first, last), pageCount))
        };
    }

    function toWorkerManual(manual: LocalManual): WorkerManual {
        return {
            id: manual.id,
            name: manual.name,
            units: manual.units.map((unit) => ({ ...unit }))
        };
    }

    return {
        readManual,
        splitWordUnits,
        groupPdfItemsIntoLines,
        extractPdfUnitsFromPages,
        repeatedMarginLines,
        marginKeys,
        normalizePdfRange,
        toWorkerManual
    };
}
