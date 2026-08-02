import type { createProjectArchive } from "../../project-archive";
import type { createExcelReport } from "./excel-report";
import type {
    ProofProjectActionsContext,
    ProofProjectBuildInput,
    ProofProjectReadResult
} from "./models";
import type { createProjectPackage } from "./project-package";

export function createProjectActions(
    archive: ReturnType<typeof createProjectArchive>,
    ProjectPackage: ReturnType<typeof createProjectPackage>,
    excelReport: ReturnType<typeof createExcelReport>
) {

    function bind(context: ProofProjectActionsContext): void {
        const input = element<HTMLInputElement>("projectInput");
        element<HTMLButtonElement>("importProjectButton").addEventListener("click", () => input.click());
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            input.value = "";
            if (!file) return;
            try {
                context.setMessage(`正在校验项目包：${file.name}`, "info");
                const restored = await ProjectPackage.read(file) as ProofProjectReadResult;
                await context.restoreProject(restored);
            } catch (error) {
                context.setMessage(error instanceof Error ? error.message : String(error), "danger");
            }
        });

        element<HTMLButtonElement>("saveProjectButton").addEventListener("click", async () => {
            const project = context.getProjectInput();
            if (!project) return context.setMessage("请先完成两本手册的比对。", "danger");
            try {
                const workbook = excelReport.buildWorkbookBytes(
                    project.comparison,
                    project.comparison.events,
                    project.decisions
                ) as Uint8Array;
                const bytes = await ProjectPackage.build({
                    ...project,
                    workbook,
                    onProgress: (message: string, completed: number, total: number) => {
                        context.setMessage(`${message}${total ? `（${completed}/${total}）` : ""}`, "info");
                    }
                } as ProofProjectBuildInput);
                archive.download(bytes, `校对之王项目_${dateStamp(new Date())}.zip`);
                context.markProjectSaved();
                context.setMessage("项目 ZIP 已保存，包含两本原手册、比较结果、人工决定、视图状态和 Excel 记录。", "success");
            } catch (error) {
                context.setMessage(error instanceof Error ? error.message : String(error), "danger");
            }
        });
    }

    function element<T extends HTMLElement>(id: string): T {
        const value = document.getElementById(id);
        if (!value) throw new Error(`页面缺少 ${id}。`);
        return value as T;
    }

    function dateStamp(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    return { bind };
}
