import type { ImageToolCompressionOptions, ImageToolImageItem } from "./models";
import * as tools from "./shared";

export function initCompress(): void {

    const images: ImageToolImageItem[] = [];
    const listEl = tools.getElement<HTMLElement>("compressList");
    const optionsEl = tools.getElement<HTMLElement>("compressOptions");
    const resultsEl = tools.getElement<HTMLElement>("compressResults");
    const qualitySlider = tools.getElement<HTMLInputElement>("compressQuality");
    const qualityValue = tools.getElement<HTMLElement>("compressQualityVal");
    const maxWidthInput = tools.getElement<HTMLInputElement>("compressMaxWidth");

    tools.setupUpload("compressUpload", "compressInput", addImages, true);
    qualitySlider.addEventListener("input", () => {
      qualityValue.textContent = qualitySlider.value;
      void updatePreview();
    });
    maxWidthInput.addEventListener("input", () => {
      void updatePreview();
    });
    tools.getElement<HTMLButtonElement>("compressBtn").addEventListener("click", () => {
      void compress();
    });
    tools.getElement<HTMLButtonElement>("compressClearBtn").addEventListener("click", () => {
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

    function buildCompressionOptions(): ImageToolCompressionOptions {
      const options: ImageToolCompressionOptions = {
        maxSizeMB: 10,
        useWebWorker: true,
        initialQuality: Number(qualitySlider.value) / 100
      };

      const maxWidth = parseInt(maxWidthInput.value, 10) || 0;
      if (maxWidth > 0) {
        options.maxWidthOrHeight = maxWidth;
      }
      return options;
    }

    async function updatePreview(): Promise<void> {
      if (images.length === 0) return;

      for (let index = 0; index < images.length; index += 1) {
        const preview = document.getElementById(`compressList-preview-${index}`);
        if (preview) {
          preview.textContent = "计算中...";
        }
      }

      for (let index = 0; index < images.length; index += 1) {
        try {
          const compressed = await imageCompression(images[index].file, buildCompressionOptions());
          const preview = document.getElementById(`compressList-preview-${index}`);
          if (!preview) {
            continue;
          }

          const saved = ((1 - compressed.size / images[index].file.size) * 100).toFixed(1);
          preview.textContent = `→${tools.formatSize(compressed.size)} (-${saved}%)`;
        } catch {
          const preview = document.getElementById(`compressList-preview-${index}`);
          if (preview) {
            preview.textContent = "";
          }
        }
      }
    }

    async function compress(): Promise<void> {
      tools.clearRenderedResults(resultsEl);

      for (const image of images) {
        try {
          const compressed = await imageCompression(image.file, buildCompressionOptions());
          const saved = ((1 - compressed.size / image.file.size) * 100).toFixed(1);
          const extension = compressed.type.includes("png") ? "png" : "jpg";
          tools.renderResultItem(
            resultsEl,
            compressed,
            `${tools.formatSize(image.file.size)} →${tools.formatSize(compressed.size)} (节省${saved}%)`,
            `${tools.getBaseName(image.file.name)}_compressed.${extension}`
          );
        } catch (error) {
          console.error("图片压缩失败:", error);
        }
      }
    }
  }
