import type { createProjectArchive } from "../../project-archive";
import type { createAuditKingCheckItemWorkbook } from "./check-item-workbook";
import type { createAuditKingDocumentReader } from "./document-reader";
import type { createAuditKingExport } from "./export";
import type { AuditKingFolderScriptGenerator } from "./folder-script-generator";
import type { createAuditKingPdfLocatorExport } from "./pdf-locator-export";
import type { createAuditKingPdfLocatorModel } from "./pdf-locator-model";
import type { AuditKingPdfLocatorPreview } from "./pdf-locator-preview";
import type { createAuditKingPdfLocatorReader } from "./pdf-locator-reader";
import type { createAuditKingPdfLocatorView } from "./pdf-locator-view";
import type { createAuditKingProjectPackage } from "./project-package";
import type { createAuditKingSearchEngine } from "./search-engine";
import type { AuditKingSourceLocator } from "./source-locator";
import type { createAuditKingState } from "./state";
import type { createAuditKingView } from "./view";

export interface AuditKingRuntime {
    XLSX: typeof import("xlsx-js-style");
    ProjectArchive: ReturnType<typeof createProjectArchive>;
    SearchEngine: ReturnType<typeof createAuditKingSearchEngine>;
    SourceLocator: typeof AuditKingSourceLocator;
    State: ReturnType<typeof createAuditKingState>;
    View: ReturnType<typeof createAuditKingView>;
    DocumentReader: ReturnType<typeof createAuditKingDocumentReader>;
    CheckItemWorkbook: ReturnType<typeof createAuditKingCheckItemWorkbook>;
    Export: ReturnType<typeof createAuditKingExport>;
    FolderScriptGenerator: typeof AuditKingFolderScriptGenerator;
    PdfLocatorModel: ReturnType<typeof createAuditKingPdfLocatorModel>;
    PdfLocatorReader: ReturnType<typeof createAuditKingPdfLocatorReader>;
    PdfLocatorPreview: typeof AuditKingPdfLocatorPreview;
    PdfLocatorExport: ReturnType<typeof createAuditKingPdfLocatorExport>;
    PdfLocatorView: ReturnType<typeof createAuditKingPdfLocatorView>;
    ProjectPackage: ReturnType<typeof createAuditKingProjectPackage>;
}
