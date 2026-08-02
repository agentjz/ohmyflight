export interface ImageToolImageItem {
  file: File;
  url: string;
}

export interface ImageToolImageProcessResult {
  blob: Blob;
  width: number;
  height: number;
}

export interface ImageToolCompressionOptions {
  maxSizeMB: number;
  useWebWorker: boolean;
  initialQuality: number;
  maxWidthOrHeight?: number;
}
