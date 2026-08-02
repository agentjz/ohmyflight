import type { PdfStampAppContext } from "./models";

export async function doExport(context: PdfStampAppContext): Promise<void> {
        if (!context.state.pdfArrayBuffer || !context.state.imgDataUrl || context.state.rules.length === 0) return;

        context.showStatus('导出中...', 'info', 0);

        try {
            const pdfDoc = await context.PDFLib.PDFDocument.load(context.state.pdfArrayBuffer);
            const imageBytes = await fetch(context.state.imgDataUrl).then(response => response.arrayBuffer());
            const embeddedImage = context.state.imgDataUrl.includes('image/png')
                ? await pdfDoc.embedPng(imageBytes)
                : await pdfDoc.embedJpg(imageBytes);

            const totalPages = pdfDoc.getPageCount();
            let stampCount = 0;

            for (let index = 0; index < totalPages; index++) {
                const pageNum = index + 1;
                const matchingRules = context.logic.getRulesForPage(context.state.rules, pageNum, context.state.pageCount);
                if (matchingRules.length === 0) continue;

                const page = pdfDoc.getPage(index);
                const { height } = page.getSize();

                for (const rule of matchingRules) {
                    page.drawImage(embeddedImage, context.logic.buildStampDrawOptions(rule, height));
                    stampCount++;
                }

                context.showStatus('处理中 ' + pageNum + ' / ' + totalPages + ' 页', 'info', pageNum / totalPages * 100);
                if (index % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
            }

            context.showStatus('正在生成文件...', 'info', 100);
            const pdfBytes = await pdfDoc.save();
            context.download(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), context.state.pdfFileName + '_stamped.pdf');
            context.showStatus('导出完成 (共添加 ' + stampCount + ' 个水印)', 'success');
        } catch (error) {
            context.showStatus('导出失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        }
    }
export function bindExport(context: PdfStampAppContext): void {
        context.getElement<HTMLButtonElement>('exportBtn').addEventListener('click', () => { void doExport(context); });
    }
