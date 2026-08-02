import type { createProjectArchive } from "../../project-archive";
import { ManualProofDecisions as Decisions } from "./decision-model";
import type {
    ProofProjectBuildInput,
    ProofProjectReadResult,
    ProofProjectSnapshot
} from "./models";
export function createProjectPackage(archive: ReturnType<typeof createProjectArchive>) {
    const schemaVersion = 1;
    const statePath = "state/proof-project.json";
    const workbookPath = "reports/revision-events.xlsx";

    async function build(input: ProofProjectBuildInput): Promise<Uint8Array> {
        const myPath = `sources/my/${archive.safeFileName(input.myFile.name)}`;
        const referencePath = `sources/reference/${archive.safeFileName(input.referenceFile.name)}`;
        const state: ProofProjectSnapshot = {
            version: schemaVersion,
            manuals: {
                my: { path: myPath, name: input.myFile.name, type: input.myFile.type, range: input.myRange },
                reference: { path: referencePath, name: input.referenceFile.name, type: input.referenceFile.type, range: input.referenceRange }
            },
            comparison: input.comparison,
            decisions: input.decisions,
            view: input.view
        };
        return archive.build({
            tool: "proof-king",
            schemaVersion,
            metadata: {
                myManualName: input.myFile.name,
                referenceManualName: input.referenceFile.name,
                eventCount: input.comparison.events.length
            },
            onProgress: input.onProgress,
            entries: [
                { path: statePath, data: JSON.stringify(state), role: "project-state", mediaType: "application/json" },
                { path: myPath, data: input.myFile, role: "my-manual", mediaType: input.myFile.type, originalName: input.myFile.name },
                { path: referencePath, data: input.referenceFile, role: "reference-manual", mediaType: input.referenceFile.type, originalName: input.referenceFile.name },
                { path: workbookPath, data: input.workbook, role: "readable-report", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", originalName: "修订事件.xlsx" }
            ]
        });
    }

    async function read(input: Blob | ArrayBuffer | Uint8Array): Promise<ProofProjectReadResult> {
        const restored = await archive.read(input, "proof-king", schemaVersion);
        const state = await restored.json(statePath) as ProofProjectSnapshot;
        validateState(state);
        return {
            state,
            myFile: await restored.file(state.manuals.my.path, state.manuals.my.name, state.manuals.my.type),
            referenceFile: await restored.file(state.manuals.reference.path, state.manuals.reference.name, state.manuals.reference.type),
            workbook: await restored.bytes(workbookPath)
        };
    }

    function validateState(state: ProofProjectSnapshot): void {
        if (state?.version !== schemaVersion || !state.manuals?.my?.path || !state.manuals?.reference?.path) {
            throw new Error("校对项目状态结构无效。");
        }
        if (!Array.isArray(state.comparison?.events) || !state.comparison?.summary) {
            throw new Error("校对项目缺少比较结果。");
        }
        const eventIds = state.comparison.events.map((event) => String(event?.id || ""));
        if (eventIds.some((id) => !id) || new Set(eventIds).size !== eventIds.length) {
            throw new Error("校对项目中的修订事件编号无效或重复。");
        }
        state.decisions = Decisions.normalize(state.comparison.events, state.decisions || {});
    }

return { schemaVersion, build, read, validateState };
}
