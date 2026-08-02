import type { PdfToolDependencies, PdfToolExtractFile } from "./models";
import * as tools from "./shared";

export function initExtract(dependencies: PdfToolDependencies): void {
    const { BootstrapModal, PDFDocument, pdfjsLib } = dependencies;

    const state = {
      files: [] as PdfToolExtractFile[],
      nextId: 1
    };

    tools.setupUpload("extractUpload", "extractInput", addExtractFiles, true);
    tools.getElement<HTMLElement>("extractFileList").addEventListener("click", (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-action][data-file-id]");
      if (!button) return;
      const fileId = Number.parseInt(button.dataset.fileId || "", 10);
      if (Number.isNaN(fileId)) return;
      const action = button.dataset.action;
      if (action === "remove") removeExtractFile(fileId);
      else if (action === "apply-range") applyExtractRange(fileId);
      else if (action === "select-all") extractSelectAll(fileId);
      else if (action === "select-none") extractSelectNone(fileId);
      else if (action === "load-preview") void startRenderPreview(fileId);
      else if (action === "extract") void doExtract(fileId);
    });

    async function addExtractFiles(files: File[]): Promise<void> {
      const autoLoad = tools.getElement<HTMLInputElement>("autoLoadPreview").checked;
      const newFileIds: number[] = [];

      for (const file of files) {
        if (file.type !== "application/pdf") {
          continue;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
          const fileId = state.nextId++;
          state.files.push({
            id: fileId,
            name: file.name,
            baseName: file.name.replace(/\.pdf$/i, ""),
            arrayBuffer,
            pdfDoc,
            pageCount: pdfDoc.numPages,
            selected: new Set<number>(),
            lastClicked: null,
            previewLoaded: false
          });
          newFileIds.push(fileId);
        } catch (error) {
          alert(`无法读取 ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      renderExtractList();

      if (!autoLoad) {
        return;
      }

      const presetRange = tools.getElement<HTMLInputElement>("presetRange").value.trim();
      for (const fileId of newFileIds) {
        await startRenderPreview(fileId);
        if (!presetRange) {
          continue;
        }

        const rangeInput = document.getElementById(`extractRange_${fileId}`) as HTMLInputElement | null;
        if (!rangeInput) {
          continue;
        }
        rangeInput.value = presetRange;
        applyExtractRange(fileId);
      }
    }

    function renderExtractList(): void {
      const list = tools.getElement<HTMLElement>("extractFileList");
      list.innerHTML = state.files.map((file) => `
        <div class="extract-file-card" data-id="${file.id}">
          <div class="card-header">
            <div class="file-title">${file.name}</div>
            <span class="badge bg-secondary">${file.pageCount}页</span>
            <button class="btn btn-sm btn-outline-danger" data-action="remove" data-file-id="${file.id}">×</button>
          </div>
          <div class="controls">
            <input type="text" id="extractRange_${file.id}" class="form-control form-control-sm" style="width:200px" placeholder="页码如: 1,3,5-10">
            <button class="btn btn-sm btn-outline-secondary" data-action="apply-range" data-file-id="${file.id}">应用范围</button>
            <button class="btn btn-sm btn-outline-secondary" data-action="select-all" data-file-id="${file.id}">全选</button>
            <button class="btn btn-sm btn-outline-secondary" data-action="select-none" data-file-id="${file.id}">清空</button>
            <span class="text-muted small" id="extractCount_${file.id}"></span>
            <button class="btn btn-sm btn-outline-primary" id="loadPreviewBtn_${file.id}" data-action="load-preview" data-file-id="${file.id}">加载预览</button>
            <input type="text" id="extractFileName_${file.id}" class="form-control form-control-sm ms-auto" style="width:200px" value="${file.baseName}_提取">
            <button class="btn btn-sm btn-primary" data-action="extract" data-file-id="${file.id}">提取选中页面</button>
          </div>
          <div id="extractGrid_${file.id}" class="preview-grid"></div>
        </div>
      `).join("");

      state.files.forEach((file) => {
        const rangeInput = document.getElementById(`extractRange_${file.id}`) as HTMLInputElement | null;
        rangeInput?.addEventListener("blur", () => applyExtractRange(file.id));
      });
    }

    function removeExtractFile(id: number): void {
      state.files = state.files.filter((file) => file.id !== id);
      renderExtractList();
    }

    function applyExtractRange(fileId: number): void {
      const file = state.files.find((entry) => entry.id === fileId);
      if (!file) {
        return;
      }

      const rangeInput = document.getElementById(`extractRange_${fileId}`) as HTMLInputElement | null;
      if (!rangeInput) {
        return;
      }
      file.selected = new Set<number>(tools.parseRange(rangeInput.value, file.pageCount));
      syncExtractUI(fileId);
    }

    async function startRenderPreview(fileId: number): Promise<void> {
      const file = state.files.find((entry) => entry.id === fileId);
      if (!file) {
        return;
      }

      const button = document.getElementById(`loadPreviewBtn_${fileId}`) as HTMLButtonElement | null;
      const grid = document.getElementById(`extractGrid_${fileId}`) as HTMLElement | null;
      const info = tools.getElement<HTMLElement>("extractInfo");
      if (!button || !grid) {
        return;
      }

      button.disabled = true;
      button.textContent = "加载中...";
      info.className = "status-bar";
      info.classList.remove("hidden");
      grid.innerHTML = "";

      try {
        for (let pageNumber = 1; pageNumber <= file.pageCount; pageNumber += 1) {
          info.textContent = `${file.name} - 渲染 ${pageNumber}/${file.pageCount}...`;
          button.textContent = `加载中 ${pageNumber}/${file.pageCount}`;

          const page = await file.pdfDoc.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: tools.getCanvasContext(canvas), viewport }).promise;

          const pageElement = document.createElement("div");
          pageElement.className = "preview-page";
          pageElement.dataset.page = String(pageNumber);
          pageElement.innerHTML = `<div class="page-label">${pageNumber}</div>`;
          pageElement.insertBefore(canvas, pageElement.firstChild);
          pageElement.onclick = (event) => handleExtractClick(fileId, pageNumber, event);
          pageElement.ondblclick = () => {
            void showHighResPreview(fileId, pageNumber);
          };
          grid.appendChild(pageElement);
        }

        file.previewLoaded = true;
        button.textContent = "预览已加载";
        info.textContent = `${file.name} - 预览加载完成`;
        syncExtractUI(fileId);
      } catch (error) {
        info.className = "status-bar error";
        info.textContent = `${file.name} - 加载失败: ${error instanceof Error ? error.message : String(error)}`;
        button.disabled = false;
        button.textContent = "加载预览";
      }
    }

    function handleExtractClick(fileId: number, page: number, event: MouseEvent): void {
      const file = state.files.find((entry) => entry.id === fileId);
      if (!file) {
        return;
      }

      if (event.shiftKey && file.lastClicked) {
        const [start, end] = [file.lastClicked, page].sort((left, right) => left - right);
        for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
          file.selected.add(pageNumber);
        }
      } else if (event.ctrlKey || event.metaKey) {
        if (file.selected.has(page)) {
          file.selected.delete(page);
        } else {
          file.selected.add(page);
        }
      } else {
        file.selected.clear();
        file.selected.add(page);
      }

      file.lastClicked = page;
      syncExtractUI(fileId);
    }

    function syncExtractUI(fileId: number): void {
      const file = state.files.find((entry) => entry.id === fileId);
      if (!file) {
        return;
      }

      const grid = document.getElementById(`extractGrid_${fileId}`);
      grid?.querySelectorAll<HTMLElement>(".preview-page").forEach((element) => {
        const pageNumber = parseInt(element.dataset.page || "", 10);
        element.classList.toggle("selected", file.selected.has(pageNumber));
      });

      const rangeInput = document.getElementById(`extractRange_${fileId}`) as HTMLInputElement | null;
      if (rangeInput) {
        rangeInput.value = tools.formatRange(file.selected);
      }

      const count = document.getElementById(`extractCount_${fileId}`);
      if (count) {
        count.textContent = file.selected.size > 0 ? `已选 ${file.selected.size} 页` : "";
      }
    }

    function extractSelectAll(fileId: number): void {
      const file = state.files.find((entry) => entry.id === fileId);
      if (!file) {
        return;
      }
      for (let pageNumber = 1; pageNumber <= file.pageCount; pageNumber += 1) {
        file.selected.add(pageNumber);
      }
      syncExtractUI(fileId);
    }

    function extractSelectNone(fileId: number): void {
      const file = state.files.find((entry) => entry.id === fileId);
      if (!file) {
        return;
      }
      file.selected.clear();
      syncExtractUI(fileId);
    }

    async function doExtract(fileId: number): Promise<void> {
      const file = state.files.find((entry) => entry.id === fileId);
      if (!file) {
        return;
      }

      const pages = file.selected.size > 0
        ? Array.from(file.selected).sort((left, right) => left - right)
        : Array.from({ length: file.pageCount }, (_, index) => index + 1);

      if (pages.length === 0) {
        alert("请选择页面");
        return;
      }

      const info = tools.getElement<HTMLElement>("extractInfo");
      info.className = "status-bar";
      info.classList.remove("hidden");
      info.textContent = `${file.name} - 提取中...`;

      try {
        const sourceDocument = await PDFDocument.load(file.arrayBuffer);
        const nextDocument = await PDFDocument.create();
        const copiedPages = await nextDocument.copyPages(sourceDocument, pages.map((page) => page - 1));
        copiedPages.forEach((page) => nextDocument.addPage(page));

        const bytes = await nextDocument.save();
        const customNameInput = document.getElementById(`extractFileName_${fileId}`) as HTMLInputElement | null;
        const customName = customNameInput?.value.trim() || "";
        const filename = customName ? (customName.endsWith(".pdf") ? customName : `${customName}.pdf`) : `${file.baseName}_提取.pdf`;

        tools.download(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), filename);
        info.textContent = `${file.name} - 已提取 ${pages.length} 页`;
      } catch (error) {
        info.className = "status-bar error";
        info.textContent = `${file.name} - 提取失败: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    async function showHighResPreview(fileId: number, pageNumber: number): Promise<void> {
      const file = state.files.find((entry) => entry.id === fileId);
      if (!file) {
        return;
      }

      try {
        const page = await file.pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = tools.getElement<HTMLCanvasElement>("previewCanvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: tools.getCanvasContext(canvas), viewport }).promise;

        tools.getElement<HTMLElement>("previewModalTitle").textContent = `${file.name} - 第 ${pageNumber} 页`;
        const modal = new BootstrapModal(tools.getElement<HTMLElement>("previewModal"));
        modal.show();
      } catch (error) {
        alert(`加载高清预览失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

}
