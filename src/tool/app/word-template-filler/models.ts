export interface WordTemplateFieldConfig {
  name: string;
  label: string;
  type: string;
  options?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  format?: string;
  subSheet?: string;
  rows?: number;
}

export interface WordTemplateAppConfig {
  fields: WordTemplateFieldConfig[];
  loopFields: Record<string, WordTemplateFieldConfig[]>;
}

export type WordTemplateXlsxApi = typeof import("xlsx-js-style");

export interface WordTemplateZipFolder {
  file(name: string, data: string | ArrayBuffer | Blob | Uint8Array): WordTemplateZipFolder;
}

export interface WordTemplateZip extends WordTemplateZipFolder {
  folder(name: string): WordTemplateZipFolder;
  generateAsync(options: { type: "blob" }): Promise<Blob>;
}

export interface WordTemplateDependencies {
  XLSX: WordTemplateXlsxApi;
  JSZip: new () => WordTemplateZip;
}
