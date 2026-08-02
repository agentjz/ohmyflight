export interface PdfToolPdfJsPage {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
}

export interface PdfToolPdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfToolPdfJsPage>;
}

export interface PdfToolPdfJsApi {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: { data: ArrayBuffer }): { promise: Promise<PdfToolPdfJsDocument> };
}

export interface PdfToolPdfPage {}

export interface PdfToolEmbeddedImage {
  width: number;
  height: number;
}

export interface PdfToolPdfDocument {
  getPageCount(): number;
  getPageIndices(): number[];
  copyPages(source: PdfToolPdfDocument, indices: number[]): Promise<PdfToolPdfPage[]>;
  addPage(page?: PdfToolPdfPage | [number, number]): {
    drawImage(image: PdfToolEmbeddedImage, options: { x: number; y: number; width: number; height: number }): void;
  };
  embedPng(bytes: ArrayBuffer): Promise<PdfToolEmbeddedImage>;
  embedJpg(bytes: ArrayBuffer): Promise<PdfToolEmbeddedImage>;
  save(): Promise<Uint8Array>;
}

export interface PdfToolPdfDocumentApi {
  create(): Promise<PdfToolPdfDocument>;
  load(buffer: ArrayBuffer): Promise<PdfToolPdfDocument>;
}

export interface PdfToolZipFolder {
  file(name: string, data: string, options: { base64: boolean }): void;
}

export interface PdfToolZip extends PdfToolZipFolder {
  folder(name: string): PdfToolZipFolder | null;
  generateAsync(options: { type: "blob" }): Promise<Blob>;
}

export interface PdfToolDependencies {
  pdfjsLib: PdfToolPdfJsApi;
  PDFDocument: PdfToolPdfDocumentApi;
  JSZip: new () => PdfToolZip;
  BootstrapModal: new (element: HTMLElement) => { show(): void };
}

export interface PdfToolExtractFile {
  id: number;
  name: string;
  baseName: string;
  arrayBuffer: ArrayBuffer;
  pdfDoc: PdfToolPdfJsDocument;
  pageCount: number;
  selected: Set<number>;
  lastClicked: number | null;
  previewLoaded: boolean;
}

export interface PdfToolMergeFile {
  id: number;
  name: string;
  size: number;
  pageCount: number;
  arrayBuffer: ArrayBuffer;
}

export interface PdfToolPdfToImageFile {
  id: number;
  name: string;
  baseName: string;
  size: number;
  arrayBuffer: ArrayBuffer;
}

export interface PdfToolImageToPdfFile {
  id: number;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}
