import type { AuditKingAppContext } from "./app-context";

    function downloadTextFile(filename: string, content: string): void {
        const blob = new Blob([content], { type: "text/x-python;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

export function bindFolderScriptActions(context: AuditKingAppContext): void {
        context.getElement<HTMLButtonElement>("exportFolderScriptBtn").addEventListener("click", () => {
            try {
                const rangeText = context.getElement<HTMLInputElement>("folderRangeInput").value;
                const python = context.runtime.FolderScriptGenerator.buildFolderCreatorPython({ rangeText });
                downloadTextFile("创建审计文件夹.py", python);
                context.runtime.View.renderStatus("已导出创建文件夹 Python。", "success");
            } catch (error) {
                context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
            }
        });
    }
