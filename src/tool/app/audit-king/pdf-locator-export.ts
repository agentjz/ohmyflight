import type { AuditKingPdfLocatorDocument, AuditKingPdfLocatorExportTask } from "./models";

export function createAuditKingPdfLocatorExport(PDFLib: any, JSZip: any) {

    function download(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    async function buildEvidencePdf(task: AuditKingPdfLocatorExportTask, documents: AuditKingPdfLocatorDocument[]): Promise<Uint8Array> {
        const documentItem = documents.find((item) => item.id === task.pdfId);
        if (!documentItem?.arrayBuffer) {
            throw new Error(`${task.sequence} 缺少 PDF 数据。`);
        }
        const source = await PDFLib.PDFDocument.load(documentItem.arrayBuffer.slice(0));
        const target = await PDFLib.PDFDocument.create();
        const pageIndexes: number[] = [];
        for (let pageNumber = task.startPage; pageNumber <= task.endPage; pageNumber += 1) {
            pageIndexes.push(pageNumber - 1);
        }
        const pages = await target.copyPages(source, pageIndexes);
        pages.forEach((page: any) => target.addPage(page));
        return target.save();
    }

    async function exportTasks(tasks: AuditKingPdfLocatorExportTask[], documents: AuditKingPdfLocatorDocument[]): Promise<{ exported: number; skipped: number }> {
        const validTasks = tasks.filter((task) => !task.skippedReason);
        const skipped = tasks.length - validTasks.length;
        if (!validTasks.length) {
            throw new Error("没有可导出的 PDF 证据。");
        }
        if (validTasks.length === 1) {
            const bytes = await buildEvidencePdf(validTasks[0], documents);
            download(new Blob([toArrayBuffer(bytes)], { type: "application/pdf" }), validTasks[0].filename);
            return { exported: 1, skipped };
        }

        const zip = new JSZip();
        for (const task of validTasks) {
            const bytes = await buildEvidencePdf(task, documents);
            zip.file(`${task.sequence}/${task.filename}`, bytes);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        download(blob, `审计之王_PDF证据_${formatTimestamp(new Date())}.zip`);
        return { exported: validTasks.length, skipped };
    }

    function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
        const output = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(output).set(bytes);
        return output;
    }

    function formatTimestamp(date: Date): string {
        const pad = (value: number) => String(value).padStart(2, "0");
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
    }

    return {
        exportTasks
    };
}
