import type { AuditKingAppContext } from "./app-context";
import type {
    AuditKingDocument,
    AuditKingPdfLocatorDocument,
    AuditProjectBuildInput,
    AuditProjectReadResult,
    AuditProjectRestoreInput
} from "./models";

export function bindProjectActions(context: AuditKingAppContext): void {
        const input = context.getElement<HTMLInputElement>("projectImportInput");
        context.getElement<HTMLButtonElement>("importProjectBtn").addEventListener("click", () => input.click());
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            input.value = "";
            if (!file) return;
            try {
                context.runtime.View.renderStatus(`正在校验项目包：${file.name}`, "info");
                const restored = await context.runtime.ProjectPackage.read(file) as AuditProjectReadResult;
                const candidate = await readCandidate(restored, context);
                context.runtime.State.restoreProject(context.state, candidate);
                context.recomputeSearch();
                context.refresh(
                    `项目已恢复：${context.state.checkItems.length} 个检查项、${context.state.documents.length} 本手册、${context.state.pdfLocator.documents.length} 个 PDF 工作区文件。`,
                    "success"
                );
            } catch (error) {
                context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
            }
        });

        context.getElement<HTMLButtonElement>("saveProjectBtn").addEventListener("click", async () => {
            try {
                if (!context.state.checklistFile) throw new Error("请先上传检查单，再保存完整项目。");
                if (!context.state.documents.length) throw new Error("请至少上传一本公司手册，再保存完整项目。");
                const workbook = context.runtime.XLSX.write(context.runtime.CheckItemWorkbook.buildWorkbook(context.state.checkItems), {
                    bookType: "xlsx",
                    type: "array"
                });
                const bytes = await context.runtime.ProjectPackage.build({
                    checklistFile: context.state.checklistFile,
                    manualFiles: context.state.documents.map((documentItem) => documentItem.sourceFile),
                    locatorFiles: context.state.pdfLocator.documents.map((documentItem) => documentItem.sourceFile),
                    state: {
                        checkItems: context.state.checkItems,
                        pdfWorkspace: {
                            slots: context.state.pdfLocator.slots,
                            selectedSlotId: context.state.pdfLocator.selectedSlotId,
                            expandContextPages: context.state.pdfLocator.expandContextPages
                        },
                        view: {
                            currentCheckItemId: context.state.currentCheckItemId,
                            documentFilterId: context.state.documentFilterId
                        }
                    },
                    workbook: new Uint8Array(workbook),
                    onProgress: (message: string, completed: number, total: number) => {
                        context.runtime.View.renderStatus(`${message}${total ? `（${completed}/${total}）` : ""}`, "info");
                    }
                } as AuditProjectBuildInput);
                context.runtime.ProjectArchive.download(bytes, `审计之王项目_${context.formatLocalDate(new Date())}.zip`);
                context.runtime.View.renderStatus("项目 ZIP 已保存，包含检查单、手册、检查项证据链、PDF 工作区文件和工作簿。", "success");
            } catch (error) {
                context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
            }
        });
    }

export async function readCandidate(result: AuditProjectReadResult, context: AuditKingAppContext): Promise<AuditProjectRestoreInput> {
        context.runtime.View.renderStatus("正在读取项目中的检查单和手册，当前页面不会被覆盖。", "info");
        const checklistDocument = await context.runtime.DocumentReader.readFile(result.checklistFile, 0) as AuditKingDocument;
        const documents: AuditKingDocument[] = [];
        for (let index = 0; index < result.manualFiles.length; index += 1) {
            documents.push(await context.runtime.DocumentReader.readFile(result.manualFiles[index], index));
        }
        const locatorDocuments = result.locatorFiles.length
            ? await context.runtime.PdfLocatorReader.readPdfFiles(result.locatorFiles) as AuditKingPdfLocatorDocument[]
            : [];
        if (documents.map((item) => item.name).join("\n") !== result.state.sources.manuals.map((item) => item.name).join("\n")) {
            throw new Error("项目中的手册清单与读取结果不一致。");
        }
        return {
            checklistFile: result.checklistFile,
            checklistBlocks: checklistDocument.blocks,
            documents,
            checkItems: result.state.checkItems,
            locatorDocuments,
            pdfWorkspace: result.state.pdfWorkspace,
            view: result.state.view
        };
    }
