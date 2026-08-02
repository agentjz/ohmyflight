import type { AuditKingPdfLocatorDocument, AuditKingPdfLocatorPage } from "./models";

export function createAuditKingPdfLocatorReader(pdfjsLib: any) {

    type PdfFileInput = Pick<File, "name" | "arrayBuffer">;

    function makeDocumentId(file: PdfFileInput, index: number): string {
        return `pdf-locator-${index + 1}-${file.name.replace(/\W+/g, "-")}`;
    }

    function getPdfJs() {
        if (!pdfjsLib) {
            throw new Error("页面缺少 PDF.js，无法读取 PDF。");
        }
        if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = "../../../libs/pdf.worker.min.js";
        }
        return pdfjsLib;
    }

    async function readPdfFile(file: PdfFileInput, index: number): Promise<AuditKingPdfLocatorDocument> {
        const pdfjs = getPdfJs();
        const id = makeDocumentId(file, index);
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
        const pages: AuditKingPdfLocatorPage[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const text = (textContent.items || [])
                .map((item: any) => String(item?.str || ""))
                .filter(Boolean)
                .join("\n");
            pages.push({
                pdfId: id,
                pdfName: file.name,
                pageNumber,
                text
            });
        }
        if (!pages.some((page) => page.text.trim())) {
            throw new Error(`${file.name} 没有可读取的文字层，暂不支持扫描件或图片 PDF。`);
        }
        return {
            id,
            name: file.name,
            pageCount: pdf.numPages,
            arrayBuffer: buffer,
            pdf,
            pages,
            sourceFile: file as File
        };
    }

    async function readPdfFiles(files: FileList | PdfFileInput[]): Promise<AuditKingPdfLocatorDocument[]> {
        const list = Array.from(files || []);
        const documents: AuditKingPdfLocatorDocument[] = [];
        for (let index = 0; index < list.length; index += 1) {
            documents.push(await readPdfFile(list[index], index));
        }
        return documents;
    }

    return {
        readPdfFiles
    };
}
