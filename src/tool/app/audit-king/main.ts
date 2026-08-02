import { createProjectArchive } from "../../project-archive";
import { createAppContext } from "./app-context";
import { bindAuditActions } from "./audit-actions";
import { bindCheckItemActions } from "./check-item-actions";
import { createAuditKingCheckItemWorkbook } from "./check-item-workbook";
import { createAuditKingDocumentReader } from "./document-reader";
import { createAuditKingExport } from "./export";
import { bindFolderScriptActions } from "./folder-script-actions";
import { AuditKingFolderScriptGenerator } from "./folder-script-generator";
import { AuditKingHighlight } from "./highlight";
import { bindMatchActions } from "./match-actions";
import { bindPdfLocatorActions } from "./pdf-locator-actions";
import { createAuditKingPdfLocatorExport } from "./pdf-locator-export";
import { createAuditKingPdfLocatorModel } from "./pdf-locator-model";
import { AuditKingPdfLocatorPreview } from "./pdf-locator-preview";
import { createAuditKingPdfLocatorReader } from "./pdf-locator-reader";
import { createAuditKingPdfLocatorView } from "./pdf-locator-view";
import { bindProjectActions } from "./project-actions";
import { createAuditKingProjectPackage } from "./project-package";
import type { AuditKingRuntime } from "./runtime";
import { createAuditKingSearchEngine } from "./search-engine";
import { AuditKingSourceLocator } from "./source-locator";
import { createAuditKingState } from "./state";
import { bindUploads } from "./upload-actions";
import { createAuditKingView } from "./view";
import { bindWorkbookActions } from "./workbook-actions";

const browserWindow = window as typeof window & {
    FlexSearch?: any;
    mammoth?: any;
    pdfjsLib?: any;
    XLSX: typeof import("xlsx-js-style");
    PDFLib?: any;
    JSZip?: any;
};

function createRuntime(): AuditKingRuntime {
    const SearchEngine = createAuditKingSearchEngine(browserWindow.FlexSearch);
    const PdfLocatorModel = createAuditKingPdfLocatorModel();
    const PdfLocatorView = createAuditKingPdfLocatorView(PdfLocatorModel);
    const ProjectArchive = createProjectArchive(browserWindow.JSZip);
    return {
        XLSX: browserWindow.XLSX,
        ProjectArchive,
        SearchEngine,
        SourceLocator: AuditKingSourceLocator,
        State: createAuditKingState({ SearchEngine, PdfLocatorModel }),
        View: createAuditKingView({ Highlight: AuditKingHighlight, SearchEngine, PdfLocatorView }),
        DocumentReader: createAuditKingDocumentReader(browserWindow.mammoth, browserWindow.pdfjsLib),
        CheckItemWorkbook: createAuditKingCheckItemWorkbook(browserWindow.XLSX),
        Export: createAuditKingExport(browserWindow.XLSX),
        FolderScriptGenerator: AuditKingFolderScriptGenerator,
        PdfLocatorModel,
        PdfLocatorReader: createAuditKingPdfLocatorReader(browserWindow.pdfjsLib),
        PdfLocatorPreview: AuditKingPdfLocatorPreview,
        PdfLocatorExport: createAuditKingPdfLocatorExport(browserWindow.PDFLib, browserWindow.JSZip),
        PdfLocatorView,
        ProjectPackage: createAuditKingProjectPackage(ProjectArchive)
    };
}

function init(): void {
    const context = createAppContext(createRuntime());
    bindUploads(context);
    bindCheckItemActions(context);
    bindMatchActions(context);
    bindAuditActions(context);
    bindWorkbookActions(context);
    bindFolderScriptActions(context);
    bindPdfLocatorActions(context);
    bindProjectActions(context);
    context.refresh("上传检查单和手册后，创建检查项并填写关键词开始检索。");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
