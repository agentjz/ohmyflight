import type { createProjectArchive } from "../../project-archive";
import type {
    AuditProjectBuildInput,
    AuditProjectReadResult,
    AuditProjectSnapshot,
    AuditProjectSourceMetadata
} from "./models";

export function createAuditKingProjectPackage(archive: ReturnType<typeof createProjectArchive>) {
    const schemaVersion = 1;
    const statePath = "state/audit-project.json";
    const workbookPath = "reports/check-items.xlsx";

    async function build(input: AuditProjectBuildInput): Promise<Uint8Array> {
        const checklist = sourceEntry(input.checklistFile, "sources/checklist", "checklist");
        const manuals = input.manualFiles.map((file, index) => sourceEntry(file, `sources/manuals/${String(index + 1).padStart(3, "0")}`, "manual"));
        const locatorFiles = input.locatorFiles.map((file, index) => sourceEntry(file, `sources/pdf-workspace/${String(index + 1).padStart(3, "0")}`, "pdf-workspace"));
        const state: AuditProjectSnapshot = {
            version: schemaVersion,
            sources: {
                checklist: metadata(checklist, input.checklistFile),
                manuals: manuals.map((entry, index) => metadata(entry, input.manualFiles[index])),
                locatorFiles: locatorFiles.map((entry, index) => metadata(entry, input.locatorFiles[index]))
            },
            checkItems: input.state.checkItems,
            pdfWorkspace: input.state.pdfWorkspace,
            view: input.state.view
        };
        return archive.build({
            tool: "audit-king",
            schemaVersion,
            metadata: {
                checklistName: input.checklistFile.name,
                manualCount: input.manualFiles.length,
                checkItemCount: input.state.checkItems.length
            },
            onProgress: input.onProgress,
            entries: [
                { path: statePath, data: JSON.stringify(state), role: "project-state", mediaType: "application/json" },
                checklist,
                ...manuals,
                ...locatorFiles,
                { path: workbookPath, data: input.workbook, role: "readable-report", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", originalName: "检查项工作簿.xlsx" }
            ]
        });
    }

    async function read(input: Blob | ArrayBuffer | Uint8Array): Promise<AuditProjectReadResult> {
        const restored = await archive.read(input, "audit-king", schemaVersion);
        const state = await restored.json(statePath) as AuditProjectSnapshot;
        validateState(state);
        return {
            state,
            checklistFile: await sourceFile(restored, state.sources.checklist),
            manualFiles: await Promise.all(state.sources.manuals.map((item) => sourceFile(restored, item))),
            locatorFiles: await Promise.all(state.sources.locatorFiles.map((item) => sourceFile(restored, item))),
            workbook: await restored.bytes(workbookPath)
        };
    }

    function sourceEntry(file: File, directory: string, role: string): { path: string; data: File; role: string; mediaType: string; originalName: string } {
        return {
            path: `${directory}/${archive.safeFileName(file.name)}`,
            data: file,
            role,
            mediaType: file.type,
            originalName: file.name
        };
    }

    function metadata(entry: { path: string }, file: File): AuditProjectSourceMetadata {
        return { path: entry.path, name: file.name, type: file.type };
    }

    async function sourceFile(
        restored: Awaited<ReturnType<typeof archive.read>>,
        source: AuditProjectSourceMetadata
    ): Promise<File> {
        return restored.file(source.path, source.name, source.type);
    }

    function validateState(state: AuditProjectSnapshot): void {
        if (state?.version !== schemaVersion || !state.sources?.checklist?.path) throw new Error("审计项目状态结构无效。");
        if (!Array.isArray(state.sources.manuals) || !Array.isArray(state.sources.locatorFiles)) throw new Error("审计项目源文件清单无效。");
        if (!Array.isArray(state.checkItems) || !Array.isArray(state.pdfWorkspace?.slots)) throw new Error("审计项目业务状态无效。");
        requireUniqueIds(state.checkItems, "检查项");
        requireUniqueIds(state.pdfWorkspace.slots, "PDF 槽位");
    }

    function requireUniqueIds(items: Array<{ id?: string }>, label: string): void {
        const ids = items.map((item) => String(item?.id || ""));
        if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
            throw new Error(`审计项目中的${label}编号无效或重复。`);
        }
    }

    return { schemaVersion, build, read, validateState };
}
