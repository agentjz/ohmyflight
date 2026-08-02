import type { AuditKingDocument, AuditKingTextBlock } from "./models";

export function createAuditKingDocumentReader(mammoth: any, pdfjsLib: any) {

    function makeDocumentId(file: Pick<File, "name">, index: number): string {
        return `doc-${index + 1}-${file.name.replace(/[^0-9a-zA-Z\u4e00-\u9fff-]+/g, "-")}`;
    }

    function guessTitle(line: string, currentTitle: string): string {
        const text = line.trim();
        if (/^\d+(?:\.\d+){1,6}(?:\s+\S.*)?$/.test(text)) return text;
        if (/^第[一二三四五六七八九十百\d]+[章节条](?:\s+\S.*)?$/.test(text)) return text;
        return currentTitle;
    }

    function splitTextBlocks(text: string, documentId: string, documentName: string): AuditKingTextBlock[] {
        const blocks: AuditKingTextBlock[] = [];
        let currentTitle = "";
        text.replace(/\r\n?/g, "\n").split(/\n+/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
            currentTitle = guessTitle(line, currentTitle);
            blocks.push({
                id: `${documentId}-b${blocks.length + 1}`,
                documentId,
                documentName,
                blockIndex: blocks.length + 1,
                title: currentTitle,
                text: line.replace(/\t+/g, " | ")
            });
        });
        return blocks;
    }

    async function readDocxFile(file: Pick<File, "name" | "arrayBuffer">, index = 0): Promise<AuditKingDocument> {
        if (!mammoth?.extractRawText) throw new Error("未加载 mammoth，无法读取 Word 文件。");
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        const id = makeDocumentId(file, index);
        const blocks = splitTextBlocks(result.value || "", id, file.name);
        if (!blocks.length) throw new Error(`${file.name} 未提取到文字。`);
        return { id, name: file.name, format: "docx", blocks, sourceFile: file as File };
    }

    function joinPdfItems(items: any[]): string {
        const ordered = items
            .map((item) => ({ text: String(item?.str || "").trim(), x: Number(item?.transform?.[4]) || 0, width: Number(item?.width) || 0 }))
            .filter((item) => item.text)
            .sort((left, right) => left.x - right.x);
        let result = "";
        let previousEnd = 0;
        ordered.forEach((item) => {
            const spaced = !!result && item.x - previousEnd > 3 && /[0-9a-zA-Z]$/.test(result) && /^[0-9a-zA-Z]/.test(item.text);
            result += `${spaced ? " " : ""}${item.text}`;
            previousEnd = Math.max(previousEnd, item.x + item.width);
        });
        return result.trim();
    }

    function groupPdfPageItems(items: any[], documentId: string, documentName: string, pageNumber: number, startIndex: number): AuditKingTextBlock[] {
        const lines = new Map<number, any[]>();
        items.forEach((item) => {
            const text = String(item?.str || "").trim();
            const y = Number(item?.transform?.[5]);
            if (!text || !Number.isFinite(y)) return;
            const key = Math.round(y / 2) * 2;
            const group = lines.get(key) || [];
            group.push(item);
            lines.set(key, group);
        });
        let currentTitle = "";
        return Array.from(lines.entries())
            .sort((left, right) => right[0] - left[0])
            .map(([, lineItems], offset) => {
                const text = joinPdfItems(lineItems);
                currentTitle = guessTitle(text, currentTitle);
                return {
                    id: `${documentId}-b${startIndex + offset}`,
                    documentId,
                    documentName,
                    blockIndex: startIndex + offset,
                    pageNumber,
                    title: currentTitle,
                    text
                };
            })
            .filter((block) => block.text);
    }

    async function readPdfFile(file: File, index = 0): Promise<AuditKingDocument> {
        if (!pdfjsLib) throw new Error("未加载 PDF.js，无法读取 PDF 文件。");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "../../../libs/pdf.worker.min.js";
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const id = makeDocumentId(file, index);
        const blocks: AuditKingTextBlock[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            blocks.push(...groupPdfPageItems(content.items || [], id, file.name, pageNumber, blocks.length + 1));
        }
        if (!blocks.length) throw new Error(`${file.name} 没有可读取文字层，暂不支持扫描件或图片 PDF。`);
        return { id, name: file.name, format: "pdf", pageCount: pdf.numPages, blocks, sourceFile: file };
    }

    async function readFile(file: File, index = 0): Promise<AuditKingDocument> {
        if (/\.docx$/i.test(file.name)) return readDocxFile(file, index);
        if (/\.pdf$/i.test(file.name)) return readPdfFile(file, index);
        throw new Error(`${file.name} 不是标准 .docx 或文字型 .pdf 文件。`);
    }

    return { readFile, readDocxFile, readPdfFile, splitTextBlocks, groupPdfPageItems };
}
