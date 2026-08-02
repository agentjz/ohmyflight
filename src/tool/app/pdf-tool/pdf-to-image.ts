import type { PdfToolDependencies, PdfToolPdfToImageFile } from "./models";
import * as tools from "./shared";

export function initPdfToImage({ JSZip, pdfjsLib }: PdfToolDependencies): void {

    const state = {
      files: [] as PdfToolPdfToImageFile[],
      nextId: 1
    };

    tools.setupUpload("pdf2imgUpload", "pdf2imgInput", addFiles, true);
    tools.getElement<HTMLElement>("pdf2imgList").addEventListener("click", (event) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button[data-file-id]");
      if (button) removePdf2ImgFile(Number.parseInt(button.dataset.fileId || "", 10));
    });
    tools.getElement<HTMLButtonElement>("pdf2imgButton").addEventListener("click", () => void doPdf2Img());
    tools.getElement<HTMLButtonElement>("clearPdf2imgButton").addEventListener("click", clearPdf2ImgList);

    async function addFiles(files: File[]): Promise<void> {
      for (const file of files) {
        if (file.type !== "application/pdf") {
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        state.files.push({
          id: state.nextId++,
          name: file.name,
          baseName: file.name.replace(/\.pdf$/i, ""),
          size: file.size,
          arrayBuffer
        });
      }

      renderList();
    }

    function renderList(): void {
      const list = tools.getElement<HTMLElement>("pdf2imgList");
      list.innerHTML = state.files.map((file) => `
        <div class="file-item" data-id="${file.id}">
          <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-meta">${tools.formatSize(file.size)}</div>
          </div>
          <button class="btn btn-sm btn-outline-danger" data-file-id="${file.id}">×</button>
        </div>
      `).join("");

      tools.getElement<HTMLElement>("pdf2imgOptions").classList.toggle("hidden", state.files.length === 0);
    }

    function removePdf2ImgFile(id: number): void {
      state.files = state.files.filter((file) => file.id !== id);
      renderList();
    }

    function clearPdf2ImgList(): void {
      state.files = [];
      renderList();
      tools.getElement<HTMLElement>("pdf2imgInfo").classList.add("hidden");
      tools.getElement<HTMLElement>("pdf2imgGrid").innerHTML = "";
    }

    async function doPdf2Img(): Promise<void> {
      if (state.files.length === 0) {
        return;
      }

      const format = tools.getElement<HTMLSelectElement>("imgFormat").value;
      const scale = parseFloat(tools.getElement<HTMLSelectElement>("imgScale").value);
      const info = tools.getElement<HTMLElement>("pdf2imgInfo");
      const grid = tools.getElement<HTMLElement>("pdf2imgGrid");
      info.className = "status-bar";
      info.classList.remove("hidden");
      grid.innerHTML = "";

      const zip = new JSZip();
      const isSingle = state.files.length === 1;

      try {
        for (let fileIndex = 0; fileIndex < state.files.length; fileIndex += 1) {
          const file = state.files[fileIndex];
          info.textContent = `处理 ${file.name} (${fileIndex + 1}/${state.files.length})...`;

          const pdfDoc = await pdfjsLib.getDocument({ data: file.arrayBuffer.slice(0) }).promise;
          const folder = isSingle ? zip : zip.folder(file.baseName);
          if (!folder) {
            throw new Error("ZIP 文件夹创建失败");
          }

          for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
            info.textContent = `${file.name} - 第 ${pageNumber}/${pdfDoc.numPages} 页`;

            const page = await pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: tools.getCanvasContext(canvas), viewport }).promise;

            const dataUrl = canvas.toDataURL(`image/${format}`, 0.92);
            const extension = format === "jpeg" ? "jpg" : "png";
            const imageName = `${file.baseName}_page${pageNumber}.${extension}`;
            folder.file(imageName, dataUrl.split(",")[1], { base64: true });

            if (!isSingle) {
              continue;
            }

            const item = document.createElement("div");
            item.className = "result-item";
            item.innerHTML = `
              <img src="${dataUrl}">
              <div class="item-footer">
                <span>第 ${pageNumber} 页</span>
                <a href="${dataUrl}" download="${imageName}">下载</a>
              </div>
            `;
            grid.appendChild(item);
          }
        }

        info.textContent = "打包下载中...";
        const blob = await zip.generateAsync({ type: "blob" });
        const zipName = isSingle ? `${state.files[0].baseName}_images.zip` : `pdf_images_${state.files.length}files.zip`;
        tools.download(blob, zipName);
        info.textContent = "转换完成，已下载 zip";
      } catch (error) {
        info.className = "status-bar error";
        info.textContent = `转换失败: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

}
