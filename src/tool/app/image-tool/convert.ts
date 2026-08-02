import type { ImageToolImageItem, ImageToolImageProcessResult } from "./models";
import * as tools from "./shared";

export function initConvert(): void {

    const images: ImageToolImageItem[] = [];
    const listEl = tools.getElement<HTMLElement>("convertList");
    const optionsEl = tools.getElement<HTMLElement>("convertOptions");
    const resultsEl = tools.getElement<HTMLElement>("convertResults");
    const qualitySlider = tools.getElement<HTMLInputElement>("convertQuality");
    const qualityValue = tools.getElement<HTMLElement>("convertQualityVal");

    tools.setupUpload("convertUpload", "convertInput", addImages, true);
    qualitySlider.addEventListener("input", () => {
      qualityValue.textContent = qualitySlider.value;
      void updatePreview();
    });
    tools.getElement<HTMLSelectElement>("convertFormat").addEventListener("change", () => {
      void updatePreview();
    });
    tools.getElement<HTMLButtonElement>("convertBtn").addEventListener("click", () => {
      void convert();
    });
    tools.getElement<HTMLButtonElement>("convertClearBtn").addEventListener("click", () => {
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

    function convertImage(file: File, format: string, quality: number): Promise<ImageToolImageProcessResult> {
      return new Promise<ImageToolImageProcessResult>((resolve) => {
        const image = new Image();
        const sourceUrl = URL.createObjectURL(file);
        image.onload = () => {
          URL.revokeObjectURL(sourceUrl);
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          tools.getCanvasContext(canvas).drawImage(image, 0, 0);

          const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
          canvas.toBlob((blob) => {
            if (!blob) {
              throw new Error("图片转换失败");
            }
            resolve({ blob, width: image.width, height: image.height });
          }, mime, quality);
        };
        image.onerror = () => URL.revokeObjectURL(sourceUrl);
        image.src = sourceUrl;
      });
    }

    async function updatePreview(): Promise<void> {
      if (images.length === 0) return;

      const format = tools.getElement<HTMLSelectElement>("convertFormat").value;
      const quality = Number(qualitySlider.value) / 100;

      for (let index = 0; index < images.length; index += 1) {
        const preview = document.getElementById(`convertList-preview-${index}`);
        if (preview) {
          preview.textContent = "计算中...";
        }
      }

      for (let index = 0; index < images.length; index += 1) {
        const result = await convertImage(images[index].file, format, quality);
        const preview = document.getElementById(`convertList-preview-${index}`);
        if (!preview) {
          continue;
        }

        const diff = ((result.blob.size / images[index].file.size - 1) * 100).toFixed(1);
        const diffValue = Number(diff);
        preview.textContent = `→${tools.formatSize(result.blob.size)} (${diffValue >= 0 ? "+" : ""}${diff}%)`;
      }
    }

    async function convert(): Promise<void> {
      const format = tools.getElement<HTMLSelectElement>("convertFormat").value;
      const quality = Number(qualitySlider.value) / 100;

      tools.clearRenderedResults(resultsEl);
      for (const image of images) {
        const result = await convertImage(image.file, format, quality);
        const extension = format === "jpeg" ? "jpg" : format;
        const filename = `${tools.getBaseName(image.file.name)}.${extension}`;
        tools.renderResultItem(
          resultsEl,
          result.blob,
          `${result.width}x${result.height} | ${tools.formatSize(result.blob.size)}`,
          filename
        );
      }
    }
  }
