import type { PdfToolDependencies, PdfToolMergeFile } from "./models";
import * as tools from "./shared";

export function initMerge({ PDFDocument }: PdfToolDependencies): void {

    const state = {
      files: [] as PdfToolMergeFile[],
      nextId: 1
    };

    tools.setupUpload("mergeUpload", "mergeInput", addMergeFiles, true);
    tools.getElement<HTMLElement>("mergeList").addEventListener("click", (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-file-id]");
      if (button) removeMergeFile(Number.parseInt(button.dataset.fileId || "", 10));
    });
    tools.getElement<HTMLButtonElement>("mergeButton").addEventListener("click", () => void doMerge());
    tools.getElement<HTMLButtonElement>("clearMergeButton").addEventListener("click", clearMergeList);

    async function addMergeFiles(files: File[]): Promise<void> {
      for (const file of files) {
        if (file.type !== "application/pdf") {
          continue;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();
          const documentRef = await PDFDocument.load(arrayBuffer);
          state.files.push({
            id: state.nextId++,
            name: file.name,
            size: file.size,
            pageCount: documentRef.getPageCount(),
            arrayBuffer
          });
        } catch {
          alert(`无法读取 ${file.name}`);
        }
      }

      renderMergeList();
    }

    function renderMergeList(): void {
      const list = tools.getElement<HTMLElement>("mergeList");
      list.innerHTML = state.files.map((file) => `
        <div class="file-item" draggable="true" data-id="${file.id}">
          <span class="drag-handle">☰⋯</span>
          <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-meta">${file.pageCount}页 · ${tools.formatSize(file.size)}</div>
          </div>
          <button class="btn btn-sm btn-outline-danger" data-file-id="${file.id}">×</button>
        </div>
      `).join("");

      tools.getElement<HTMLElement>("mergeActions").classList.toggle("hidden", state.files.length === 0);
      tools.initDragSort(list, state.files, renderMergeList);
    }

    function removeMergeFile(id: number): void {
      state.files = state.files.filter((file) => file.id !== id);
      renderMergeList();
    }

    function clearMergeList(): void {
      state.files = [];
      renderMergeList();
      tools.getElement<HTMLElement>("mergeStatus").classList.add("hidden");
    }

    async function doMerge(): Promise<void> {
      if (state.files.length < 2) {
        alert("请至少添加 2 个 PDF");
        return;
      }

      const status = tools.getElement<HTMLElement>("mergeStatus");
      status.className = "status-bar";
      status.classList.remove("hidden");
      status.textContent = "合并中...";

      try {
        const merged = await PDFDocument.create();
        let totalPages = 0;

        for (const file of state.files) {
          const source = await PDFDocument.load(file.arrayBuffer);
          const pages = await merged.copyPages(source, source.getPageIndices());
          pages.forEach((page) => merged.addPage(page));
          totalPages += pages.length;
        }

        const bytes = await merged.save();
        tools.download(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), `merged_${state.files.length}files.pdf`);
        status.textContent = `已合并 ${state.files.length} 个文件，共 ${totalPages} 页`;
      } catch (error) {
        status.className = "status-bar error";
        status.textContent = `合并失败: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

}
