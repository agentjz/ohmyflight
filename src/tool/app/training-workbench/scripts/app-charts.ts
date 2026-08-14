import { TrainingToolUtils } from "./utils";
import type {
  TrainingChartData,
  TrainingCrmAnnualResult,
  TrainingLoadResult,
  TrainingQualificationPressureResult,
  TrainingSmartScheduleResult,
  TrainingToolAppRuntime
} from "./models";
import { TrainingToolWorkbenchStatus } from "./workbench-status";
import { getTrainingEcharts } from "./browser-vendors";
import type { TrainingChartInstance, TrainingChartOption, TrainingEchartsApi } from "./browser-vendors";

export function installTrainingAppCharts(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const WorkbenchStatus = TrainingToolWorkbenchStatus;
  const elements = runtime.elements;
  let workbenchStatusChart: TrainingChartInstance | null = null;
  let workbenchProjectChart: TrainingChartInstance | null = null;
  let qualificationPressureChart: TrainingChartInstance | null = null;
  let trainingLoadChart: TrainingChartInstance | null = null;
  let smartScheduleChart: TrainingChartInstance | null = null;
  let crmParticipationChart: TrainingChartInstance | null = null;
  let crmMonthlyChart: TrainingChartInstance | null = null;
  let crmRoleChart: TrainingChartInstance | null = null;
  let resizeFrameId = 0;

  function getEcharts(): TrainingEchartsApi | null {
    return getTrainingEcharts();
  }

  function getOrCreateChart(element: HTMLElement, currentChart: TrainingChartInstance | null): TrainingChartInstance {
    const echarts = getEcharts();
    if (!echarts) return null as unknown as TrainingChartInstance;
    return currentChart || echarts.init(element);
  }

  function getCssColor(name: string, fallback: string): string {
    const value = window.getComputedStyle
      ? window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      : "";
    return value || fallback;
  }

  function getChartColors() {
    return {
      info: getCssColor("--st-info-soft", "#eff6ff"),
      ok: getCssColor("--st-success-soft", "#b7efc5"),
      danger: getCssColor("--st-danger-soft", "#ffc9c7")
    };
  }

  function getChartTheme() {
    const text = getCssColor("--watchdog-text", "#1f2328");
    const muted = getCssColor("--watchdog-text-muted", "#656d76");
    const surface = getCssColor("--watchdog-surface", "#ffffff");
    const border = getCssColor("--watchdog-border", "#d0d7de");

    return {
      text,
      muted,
      surface,
      border,
      textStyle: {
        color: text,
        textBorderWidth: 0,
        textShadowBlur: 0
      },
      mutedTextStyle: {
        color: muted,
        textBorderWidth: 0,
        textShadowBlur: 0
      },
      axisLine: { lineStyle: { color: border } },
      splitLine: { lineStyle: { color: border } },
      tooltip: {
        backgroundColor: surface,
        borderColor: border,
        textStyle: { color: text }
      }
    };
  }

  function withChartTheme(option: TrainingChartOption): TrainingChartOption {
    const theme = getChartTheme();
    return {
      textStyle: theme.textStyle,
      ...option,
      tooltip: option.tooltip ? { ...theme.tooltip, ...option.tooltip } : option.tooltip,
      legend: option.legend ? { textStyle: theme.textStyle, inactiveColor: theme.muted, ...option.legend } : option.legend,
      xAxis: option.xAxis ? {
        axisLine: theme.axisLine,
        splitLine: theme.splitLine,
        ...option.xAxis,
        axisLabel: { ...theme.mutedTextStyle, ...(option.xAxis.axisLabel || {}) }
      } : option.xAxis,
      yAxis: Array.isArray(option.yAxis)
        ? option.yAxis.map((axis) => ({
          axisLine: theme.axisLine,
          splitLine: theme.splitLine,
          ...axis,
          axisLabel: { ...theme.mutedTextStyle, ...(axis.axisLabel || {}) }
        }))
        : option.yAxis ? {
          axisLine: theme.axisLine,
          splitLine: theme.splitLine,
          ...option.yAxis,
          axisLabel: { ...theme.mutedTextStyle, ...(option.yAxis.axisLabel || {}) }
        } : option.yAxis
    };
  }

  function renderChartEmpty(element: HTMLElement, message: string): void {
    element.innerHTML = `<div class="empty-block">${Utils.escapeHtml(message)}</div>`;
  }

  function getPressureMode(): string {
    return elements.qualificationPressureModeGroup.querySelector<HTMLInputElement>('input[name="qualificationPressureMode"]:checked')?.value || "forecast";
  }

  function renderWorkbenchCharts(chartData: TrainingChartData | null): void {
    const echarts = getEcharts();
    if (!echarts) {
      renderChartEmpty(elements.workbenchStatusChart, "图表库未加载。");
      renderChartEmpty(elements.workbenchProjectChart, "图表库未加载。");
      return;
    }

    const statusRows = chartData && chartData.statusRows ? chartData.statusRows : [];
    const projectRows = chartData && chartData.projectRows ? chartData.projectRows : [];
    const visibleSeries = WorkbenchStatus.VISIBLE_STATUS_FIELDS.map((item) => ({
      name: item.status,
      field: item.field
    }));

    workbenchStatusChart = getOrCreateChart(elements.workbenchStatusChart, workbenchStatusChart);
    workbenchProjectChart = getOrCreateChart(elements.workbenchProjectChart, workbenchProjectChart);

    workbenchStatusChart.setOption(withChartTheme({
      tooltip: { trigger: "item" },
      legend: { bottom: 0, left: "center" },
      series: [{
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "42%"],
        avoidLabelOverlap: true,
        label: getChartTheme().textStyle,
        data: statusRows
      }]
    }));

    workbenchProjectChart.setOption(withChartTheme({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { top: 0 },
      grid: { top: 44, right: 18, bottom: 12, left: 86, containLabel: true },
      xAxis: {
        type: "value",
        minInterval: 1
      },
      yAxis: {
        type: "category",
        data: projectRows.map((row) => row.projectName),
        axisLabel: {
          interval: 0,
          fontSize: 11,
          width: 76,
          overflow: "truncate"
        }
      },
      series: visibleSeries.map((item) => ({
        name: item.name,
        type: "bar",
        stack: "total",
        data: projectRows.map((row) => row[item.field])
      }))
    }));

    workbenchStatusChart.resize();
    workbenchProjectChart.resize();
  }

  function renderQualificationPressureChart(result: TrainingQualificationPressureResult | null, mode: string): void {
    const echarts = getEcharts();
    if (!echarts) {
      renderChartEmpty(elements.qualificationPressureChart, "图表库未加载。");
      return;
    }
    const monthRows = result?.monthRows || [];
    const projects = result?.projects || [];
    const useCurrent = mode === "current";
    const series = projects.map((projectName) => ({
        name: projectName,
        type: "bar",
        stack: "qualification",
        data: monthRows.map((row) => (useCurrent ? row.currentByProject : row.forecastByProject)[projectName] || 0)
      }));

    qualificationPressureChart = getOrCreateChart(elements.qualificationPressureChart, qualificationPressureChart);
    qualificationPressureChart.clear();
    qualificationPressureChart.setOption(withChartTheme({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { top: 0, type: "scroll" },
      grid: { top: 50, right: 28, bottom: 58, left: 48, containLabel: true },
      dataZoom: [
        { type: "slider", xAxisIndex: 0, bottom: 8, height: 18, start: 0, end: Math.min(100, monthRows.length ? 18 / monthRows.length * 100 : 100) },
        { type: "inside", xAxisIndex: 0 }
      ],
      xAxis: {
        type: "category",
        data: monthRows.map((row) => row.monthKey),
        axisLabel: { interval: 0, fontSize: 11, rotate: 35 }
      },
      yAxis: { type: "value", minInterval: 1, name: "人项" },
      series
    }));
    qualificationPressureChart.off("click");
    qualificationPressureChart.on("click", (params) => {
      if (params.name) runtime.renderers.renderQualificationPressure(params.name);
    });
    qualificationPressureChart.resize();
  }

  function renderTrainingLoadChart(result: TrainingLoadResult | null): void {
    const echarts = getEcharts();
    if (!echarts) {
      renderChartEmpty(elements.trainingLoadChart, "图表库未加载。");
      return;
    }
    const monthRows = result?.monthRows || [];
    trainingLoadChart = getOrCreateChart(elements.trainingLoadChart, trainingLoadChart);
    trainingLoadChart.clear();
    trainingLoadChart.setOption(withChartTheme({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { top: 0 },
      grid: { top: 44, right: 28, bottom: 38, left: 48, containLabel: true },
      xAxis: {
        type: "category",
        data: monthRows.map((row) => row.monthKey),
        axisLabel: { interval: 0, fontSize: 11 }
      },
      yAxis: [
        { type: "value", minInterval: 1, name: "人天", nameTextStyle: getChartTheme().mutedTextStyle },
        { type: "value", minInterval: 1, name: "班次", nameTextStyle: getChartTheme().mutedTextStyle }
      ],
      series: [
        { name: "人天", type: "bar", yAxisIndex: 0, data: monthRows.map((row) => row.personDays) },
        { name: "班次", type: "line", yAxisIndex: 1, symbol: "circle", data: monthRows.map((row) => row.sessionCount) }
      ]
    }));
    trainingLoadChart.resize();
  }

  function renderSmartScheduleChart(result: TrainingSmartScheduleResult | null): void {
    const echarts = getEcharts();
    if (!echarts) {
      renderChartEmpty(elements.smartScheduleChart, "图表库未加载。");
      return;
    }
    const monthRows = result?.monthRows || [];
    smartScheduleChart = getOrCreateChart(elements.smartScheduleChart, smartScheduleChart);
    smartScheduleChart.clear();
    smartScheduleChart.setOption(withChartTheme({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { top: 0 },
      grid: { top: 44, right: 28, bottom: 38, left: 48, containLabel: true },
      xAxis: {
        type: "category",
        data: monthRows.map((row) => row.monthKey),
        axisLabel: { interval: 0, fontSize: 11 }
      },
      yAxis: { type: "value", minInterval: 1, name: "人天" },
      series: [
        { name: "当前排班", type: "bar", data: monthRows.map((row) => row.currentPersonDays) },
        { name: "均衡方案", type: "bar", data: monthRows.map((row) => row.balancedPersonDays) },
        {
          name: "月均参考",
          type: "line",
          symbol: "none",
          lineStyle: { type: "dashed" },
          data: monthRows.map((row) => row.averagePersonDays)
        }
      ]
    }));
    smartScheduleChart.off("click");
    smartScheduleChart.on("click", (params) => {
      if (params.name) runtime.renderers.renderSmartSchedule(params.name);
    });
    smartScheduleChart.resize();
  }

  function renderCrmCharts(result: TrainingCrmAnnualResult | null): void {
    const echarts = getEcharts();
    if (!echarts) {
      renderChartEmpty(elements.crmParticipationChart, "图表库未加载。");
      renderChartEmpty(elements.crmMonthlyChart, "图表库未加载。");
      renderChartEmpty(elements.crmRoleChart, "图表库未加载。");
      return;
    }

    const participationRows = result && result.participationRows ? result.participationRows : [];
    const monthlyRows = result && result.monthlyRows ? result.monthlyRows : [];
    const roleRows = result && result.roleRows ? result.roleRows : [];

    crmParticipationChart = getOrCreateChart(elements.crmParticipationChart, crmParticipationChart);
    crmMonthlyChart = getOrCreateChart(elements.crmMonthlyChart, crmMonthlyChart);
    crmRoleChart = getOrCreateChart(elements.crmRoleChart, crmRoleChart);
    const chartColors = getChartColors();
    const colorForCrmKind = (kind: string | undefined): string => (kind === "missing" ? chartColors.danger : chartColors.ok);

    crmParticipationChart.setOption(withChartTheme({
      tooltip: { trigger: "item" },
      legend: { bottom: 0, left: "center" },
      series: [{
        type: "pie",
        radius: ["42%", "68%"],
        center: ["50%", "42%"],
        startAngle: 90,
        clockwise: false,
        avoidLabelOverlap: true,
        label: {
          show: false
        },
        labelLine: {
          show: false
        },
        data: participationRows.map((row) => ({
          name: row.name,
          value: row.value,
          itemStyle: { color: colorForCrmKind(row.kind) }
        })),
        colorBy: "data"
      }]
    }));

    crmMonthlyChart.setOption(withChartTheme({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { top: 20, right: 28, bottom: 36, left: 48, containLabel: true },
      xAxis: {
        type: "category",
        data: monthlyRows.map((row) => row.label),
        axisLabel: { interval: 0, fontSize: 11 }
      },
      yAxis: { type: "value", minInterval: 1 },
      series: [{
        name: "人数",
        type: "bar",
        label: {
          show: true,
          position: "top",
          ...getChartTheme().textStyle
        },
        itemStyle: {
          color(params: { dataIndex: number }) {
            const item = monthlyRows[params.dataIndex];
            return colorForCrmKind(item && item.kind);
          }
        },
        data: monthlyRows.map((row) => row.count)
      }]
    }));

    crmRoleChart.setOption(withChartTheme({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter(value: unknown) {
          return `${value}人`;
        }
      },
      legend: { top: 0 },
      grid: { top: 42, right: 48, bottom: 18, left: 70, containLabel: true },
      xAxis: {
        type: "value",
        minInterval: 1
      },
      yAxis: {
        type: "category",
        data: roleRows.map((row) => row.role),
        axisLabel: { interval: 0, fontSize: 12 }
      },
      series: [
        {
          name: "已参加",
          type: "bar",
          stack: "total",
          itemStyle: { color: colorForCrmKind("attended") },
          label: {
            show: true,
            ...getChartTheme().textStyle,
            formatter(params: { value: unknown }) {
              return params.value ? `${params.value}` : "";
            }
          },
          data: roleRows.map((row) => row.attended)
        },
        {
          name: "未参加",
          type: "bar",
          stack: "total",
          itemStyle: { color: colorForCrmKind("missing") },
          label: {
            show: true,
            ...getChartTheme().textStyle,
            formatter(params: { value: unknown }) {
              return params.value ? `${params.value}` : "";
            }
          },
          data: roleRows.map((row) => row.missing)
        }
      ]
    }));

    crmParticipationChart.resize();
    crmMonthlyChart.resize();
    crmRoleChart.resize();
  }

  function refreshRenderedCharts(): void {
    const state = runtime.state;
    if (state.workbenchResult && state.workbenchResult.chartData) {
      renderWorkbenchCharts(state.workbenchResult.chartData);
    }
    if (state.qualificationPressure) renderQualificationPressureChart(state.qualificationPressure, getPressureMode());
    if (state.trainingLoad) renderTrainingLoadChart(state.trainingLoad);
    if (state.smartSchedule) renderSmartScheduleChart(state.smartSchedule);
    if (state.crmAnnualResult) {
      renderCrmCharts(state.crmAnnualResult);
    }
  }

  function resizeRenderedCharts(): void {
    [
      workbenchStatusChart,
      workbenchProjectChart,
      qualificationPressureChart,
      trainingLoadChart,
      smartScheduleChart,
      crmParticipationChart,
      crmMonthlyChart,
      crmRoleChart
    ].forEach((chart) => chart?.resize());
  }

  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(resizeFrameId);
    resizeFrameId = window.requestAnimationFrame(resizeRenderedCharts);
  });

  window.addEventListener("watchdog:themechange", () => {
    window.setTimeout(refreshRenderedCharts, 0);
  });

  runtime.charts = {
    renderWorkbenchCharts,
    renderQualificationPressureChart,
    renderTrainingLoadChart,
    renderSmartScheduleChart,
    renderCrmCharts,
    refreshRenderedCharts
  };
}
