import type { ImageToolImageItem } from "./models";

export function getElement<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

export function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }
    return context;
  }

export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

export function getBaseName(filename: string): string {
    return filename.replace(/\.[^/.]+$/, "");
  }

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
export function setObjectUrl(element: HTMLImageElement, value: Blob | File | null): void {
    const previous = element.dataset.objectUrl;
    if (previous) URL.revokeObjectURL(previous);
    if (!value) {
      delete element.dataset.objectUrl;
      element.removeAttribute("src");
      return;
    }
    const url = URL.createObjectURL(value);
    element.dataset.objectUrl = url;
    element.src = url;
  }

export function clearImageItems(images: ImageToolImageItem[]): void {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    images.length = 0;
  }

export function removeImageItem(images: ImageToolImageItem[], index: number): void {
    const [removed] = images.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.url);
  }

export function clearRenderedResults(container: HTMLElement): void {
    container.querySelectorAll<HTMLImageElement>("img[data-object-url]").forEach((image) => setObjectUrl(image, null));
    container.replaceChildren();
  }

export function setupUpload(
    areaId: string,
    inputId: string,
    handler: (files: File[]) => void,
    multiple: boolean
  ): void {
    const area = getElement<HTMLElement>(areaId);
    const input = getElement<HTMLInputElement>(inputId);

    area.onclick = () => input.click();
    area.ondragover = (event) => {
      event.preventDefault();
      area.classList.add("dragover");
    };
    area.ondragleave = () => area.classList.remove("dragover");
    area.ondrop = (event) => {
      event.preventDefault();
      area.classList.remove("dragover");
      const files = Array.from(event.dataTransfer?.files || []);
      handler(multiple ? files : files.slice(0, 1));
    };
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      handler(Array.from(target.files || []));
      target.value = "";
    };
  }

export function renderImageList(
    images: ImageToolImageItem[],
    listEl: HTMLElement,
    optionsEl: HTMLElement,
    onRemove: (index: number) => void
  ): void {
    if (images.length === 0) {
      listEl.innerHTML = "";
      optionsEl.classList.add("hidden");
      return;
    }

    optionsEl.classList.remove("hidden");
    listEl.innerHTML = images.map((img, index) => `
      <div class="image-item">
        <img src="${img.url}">
        <div class="info">${formatSize(img.file.size)}</div>
        <div class="preview-info" id="${listEl.id}-preview-${index}"></div>
        <button class="remove-btn" data-i="${index}">&times;</button>
      </div>
    `).join("");

    listEl.querySelectorAll<HTMLButtonElement>(".remove-btn").forEach((button) => {
      button.onclick = () => onRemove(parseInt(button.dataset.i || "0", 10));
    });
  }

export function renderResultItem(container: HTMLElement, blob: Blob, text: string, filename: string): void {
    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `
      <img>
      <span class="meta">${text}</span>
      <button class="btn btn-outline-secondary btn-sm">下载</button>
    `;

    setObjectUrl(item.querySelector("img") as HTMLImageElement, blob);
    const downloadButton = item.querySelector("button") as HTMLButtonElement;
    downloadButton.onclick = () => downloadBlob(blob, filename);
    container.appendChild(item);
  }
