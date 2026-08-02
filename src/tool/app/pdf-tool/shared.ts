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
      handler(Array.from(event.dataTransfer?.files || []));
    };
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      handler(Array.from(target.files || []));
      target.value = "";
    };
  }

export function initDragSort<T extends { id: number }>(
    container: HTMLElement,
    dataArray: T[],
    render: () => void
  ): void {
    let dragged: HTMLElement | null = null;

    container.querySelectorAll<HTMLElement>('[draggable="true"]').forEach((item) => {
      item.ondragstart = () => {
        dragged = item;
        item.style.opacity = "0.5";
      };
      item.ondragend = () => {
        item.style.opacity = "1";
        dragged = null;
      };
      item.ondragover = (event) => event.preventDefault();
      item.ondrop = (event) => {
        event.preventDefault();
        if (!dragged || item === dragged) {
          return;
        }

        const fromId = parseInt(dragged.dataset.id || "", 10);
        const toId = parseInt(item.dataset.id || "", 10);
        const fromIndex = dataArray.findIndex((entry) => entry.id === fromId);
        const toIndex = dataArray.findIndex((entry) => entry.id === toId);
        if (fromIndex === -1 || toIndex === -1) {
          return;
        }

        const [removed] = dataArray.splice(fromIndex, 1);
        dataArray.splice(toIndex, 0, removed);
        render();
      };
    });
  }

export function parseRange(value: string, max: number): number[] {
    if (!value.trim()) {
      return [];
    }

    const pages = new Set<number>();
    value.split(",").forEach((part) => {
      const text = part.trim();
      if (!text) {
        return;
      }

      if (text.includes("-")) {
        const [startText, endText] = text.split("-");
        const start = parseInt(startText.trim(), 10);
        const end = parseInt(endText.trim(), 10);
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          for (let page = Math.max(1, start); page <= Math.min(max, end); page += 1) {
            pages.add(page);
          }
        }
        return;
      }

      const page = parseInt(text, 10);
      if (!Number.isNaN(page) && page >= 1 && page <= max) {
        pages.add(page);
      }
    });

    return Array.from(pages).sort((left, right) => left - right);
  }

export function formatRange(selectedPages: Set<number>): string {
    if (selectedPages.size === 0) {
      return "";
    }

    const sorted = Array.from(selectedPages).sort((left, right) => left - right);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let index = 1; index <= sorted.length; index += 1) {
      const current = sorted[index];
      if (current === end + 1) {
        end = current;
        continue;
      }

      ranges.push(start === end ? String(start) : `${start}-${end}`);
      if (index < sorted.length) {
        start = current;
        end = current;
      }
    }

    return ranges.join(",");
  }

export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

export function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("图片读取失败"));
          return;
        }
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

export function download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
