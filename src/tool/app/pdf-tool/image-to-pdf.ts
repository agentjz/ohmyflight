import type { PdfToolDependencies, PdfToolImageToPdfFile } from "./models";
import * as tools from "./shared";

export function initImageToPdf({ PDFDocument }: PdfToolDependencies): void {

    const state = {
      images: [] as PdfToolImageToPdfFile[],
      nextId: 1
    };

    tools.setupUpload("img2pdfUpload", "img2pdfInput", addFiles, true);
    tools.getElement<HTMLElement>("img2pdfList").addEventListener("click", (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-file-id]");
      if (button) removeImg2PdfFile(Number.parseInt(button.dataset.fileId || "", 10));
    });
    tools.getElement<HTMLButtonElement>("img2pdfButton").addEventListener("click", () => void doImg2Pdf());
    tools.getElement<HTMLButtonElement>("clearImg2pdfButton").addEventListener("click", clearImg2PdfList);

    async function addFiles(files: File[]): Promise<void> {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          continue;
        }

        const dataUrl = await tools.readFileAsDataUrl(file);
        state.images.push({
          id: state.nextId++,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl
        });
      }

      renderList();
    }

    function renderList(): void {
      const list = tools.getElement<HTMLElement>("img2pdfList");
      list.innerHTML = state.images.map((image) => `
        <div class="file-item" draggable="true" data-id="${image.id}">
          <span class="drag-handle">☰⋯</span>
          <img src="${image.dataUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">
          <div class="file-info">
            <div class="file-name">${image.name}</div>
            <div class="file-meta">${tools.formatSize(image.size)}</div>
          </div>
          <button class="btn btn-sm btn-outline-danger" data-file-id="${image.id}">×</button>
        </div>
      `).join("");

      tools.getElement<HTMLElement>("img2pdfActions").classList.toggle("hidden", state.images.length === 0);
      tools.initDragSort(list, state.images, renderList);
    }

    function removeImg2PdfFile(id: number): void {
      state.images = state.images.filter((image) => image.id !== id);
      renderList();
    }

    function clearImg2PdfList(): void {
      state.images = [];
      renderList();
      tools.getElement<HTMLElement>("img2pdfStatus").classList.add("hidden");
    }

    async function doImg2Pdf(): Promise<void> {
      if (state.images.length === 0) {
        alert("请添加图片");
        return;
      }

      const status = tools.getElement<HTMLElement>("img2pdfStatus");
      status.className = "status-bar";
      status.classList.remove("hidden");
      status.textContent = "生成中...";

      try {
        const pdfDoc = await PDFDocument.create();

        for (let index = 0; index < state.images.length; index += 1) {
          status.textContent = `处理第 ${index + 1}/${state.images.length} 张...`;
          const image = state.images[index];
          const bytes = await fetch(image.dataUrl).then((response) => response.arrayBuffer());
          const embedded = image.type === "image/png"
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);

          const page = pdfDoc.addPage([embedded.width, embedded.height]);
          page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
        }

        const pdfBytes = await pdfDoc.save();
        tools.download(new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }), `images_${state.images.length}pages.pdf`);
        status.textContent = `已生成 ${state.images.length} 页 PDF`;
      } catch (error) {
        status.className = "status-bar error";
        status.textContent = `生成失败: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

}
