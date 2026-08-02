type TrainingXlsxApi = typeof import("xlsx-js-style");

export interface TrainingChartInstance {
  setOption(option: TrainingChartOption): void;
  resize(): void;
}

export interface TrainingChartOption {
  tooltip?: Record<string, unknown>;
  legend?: Record<string, unknown>;
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TrainingEchartsApi {
  init(element: HTMLElement): TrainingChartInstance;
}

function requireVendor<T>(name: string): T {
  const value = (globalThis as typeof globalThis & Record<string, unknown>)[name];
  if (!value) throw new Error(`页面缺少第三方依赖：${name}`);
  return value as T;
}

export function getTrainingXlsx(): TrainingXlsxApi | null {
  return ((globalThis as typeof globalThis & { XLSX?: TrainingXlsxApi }).XLSX) || null;
}

export function getTrainingEcharts(): TrainingEchartsApi | null {
  return ((globalThis as typeof globalThis & { echarts?: TrainingEchartsApi }).echarts) || null;
}

export const TrainingXlsx = new Proxy({} as TrainingXlsxApi, {
  get(_target, property) {
    return requireVendor<TrainingXlsxApi>("XLSX")[property as keyof TrainingXlsxApi];
  }
});
