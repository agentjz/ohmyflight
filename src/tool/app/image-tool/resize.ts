import type { ImageToolImageItem, ImageToolImageProcessResult } from "./models";
import * as tools from "./shared";

export function initResize(): void {

    const images: ImageToolImageItem[] = [];
    const listEl = tools.getElement<HTMLElement>("resizeList");
    const optionsEl = tools.getElement<HTMLElement>("resizeOptions");
    const resultsEl = tools.getElement<HTMLElement>("resizeResults");
    const widthInput = tools.getElement<HTMLInputElement>("resizeWidth");
    const heightInput = tools.getElement<HTMLInputElement>("resizeHeight");
    const keepRatioInput = tools.getElement<HTMLInputElement>("resizeKeepRatio");
    const picaFactory = window.pica ? window.pica() : new pica();

    tools.setupUpload("resizeUpload", "resizeInput", addImages, true);
    widthInput.addEventListener("input", () => {
      void updatePreview();
    });
    heightInput.addEventListener("input", () => {
      void updatePreview();
    });
    keepRatioInput.addEventListener("change", () => {
      void updatePreview();
    });
    tools.getElement<HTMLButtonElement>("resizeBtn").addEventListener("click", () => {
      void doResize();
    });
    tools.getElement<HTMLButtonElement>("resizeClearBtn").addEventListener("click", () => {
      tools.clearImageItems(images);
      render();
      tools.clearRenderedResults(resultsEl);
    });

    function addImages(files: File[]): void {
      files.forEach((file) => {
        if (file.type.startsWith("image/")) {
          images.push({ file, url: URL.createObjectURL(file) });
        }
      });
      render();
      void updatePreview();
    }

    function render(): void {
      tools.renderImageList(images, listEl, optionsEl, (index) => {
        tools.removeImageItem(images, index);
        render();
        void updatePreview();
      });
    }

    function resizeImage(
      file: File,
      targetWidth: number,
      targetHeight: number,
      keepRatio: boolean
    ): Promise<ImageToolImageProcessResult> {
      return new Promise<ImageToolImageProcessResult>((resolve) => {
        const image = new Image();
        const sourceUrl = URL.createObjectURL(file);
        image.onload = async () => {
          URL.revokeObjectURL(sourceUrl);
          let width = targetWidth;
          let height = targetHeight;
          if (keepRatio) {
            const ratio = Math.min(targetWidth / image.width, targetHeight / image.height);
            width = Math.round(image.width * ratio);
            height = Math.round(image.height * ratio);
          }

          const sourceCanvas = document.createElement("canvas");
          sourceCanvas.width = image.width;
          sourceCanvas.height = image.height;
          tools.getCanvasContext(sourceCanvas).drawImage(image, 0, 0);

          const destinationCanvas = document.createElement("canvas");
          destinationCanvas.width = width;
          destinationCanvas.height = height;
          await picaFactory.resize(sourceCanvas, destinationCanvas, { quality: 3, alpha: true });

          destinationCanvas.toBlob((blob) => {
            if (!blob) {
              throw new Error("图片缩放失败");
            }
            resolve({ blob, width, height });
          }, "image/png");
        };
        image.onerror = () => URL.revokeObjectURL(sourceUrl);
        image.src = sourceUrl;
      });
    }

    async function updatePreview(): Promise<void> {
      if (images.length === 0) return;

      const targetWidth = parseInt(widthInput.value, 10);
      const targetHeight = parseInt(heightInput.value, 10);
      const keepRatio = keepRatioInput.checked;

      for (let index = 0; index < images.length; index += 1) {
        const preview = document.getElementById(`resizeList-preview-${index}`);
        if (preview) {
          preview.textContent = "计算中...";
        }
      }

      for (let index = 0; index < images.length; index += 1) {
        try {
          const result = await resizeImage(images[index].file, targetWidth, targetHeight, keepRatio);
          const preview = document.getElementById(`resizeList-preview-${index}`);
          if (preview) {
            preview.textContent = `→${result.width}x${result.height} | ${tools.formatSize(result.blob.size)}`;
          }
        } catch {
          const preview = document.getElementById(`resizeList-preview-${index}`);
          if (preview) {
            preview.textContent = "";
          }
        }
      }
    }

    async function doResize(): Promise<void> {
      const targetWidth = parseInt(widthInput.value, 10);
      const targetHeight = parseInt(heightInput.value, 10);
      const keepRatio = keepRatioInput.checked;

      tools.clearRenderedResults(resultsEl);
      for (const image of images) {
        const result = await resizeImage(image.file, targetWidth, targetHeight, keepRatio);
        tools.renderResultItem(
          resultsEl,
          result.blob,
          `${result.width}x${result.height} | ${tools.formatSize(result.blob.size)}`,
          `${tools.getBaseName(image.file.name)}_resized.png`
        );
      }
    }
  }
