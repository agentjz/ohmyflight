import { TrainingToolCrmExport } from "./crm-export";
import type { TrainingToolAppRuntime, TrainingToolWorkbook } from "./models";
import { TrainingToolReportSheet } from "./report-sheet";
import { TrainingToolScanner } from "./scanner";
import { TrainingToolUtils } from "./utils";
import { TrainingToolValidity } from "./validity";
import { TrainingToolWorkbenchExport } from "./workbench-export";
import { TrainingToolWorkbookHealth } from "./workbook-health";
import { TrainingXlsx as XLSX } from "./browser-vendors";

export function installTrainingAppActions(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const Scanner = TrainingToolScanner;
  const Validity = TrainingToolValidity;
  const WorkbenchExport = TrainingToolWorkbenchExport;
  const CrmExport = TrainingToolCrmExport;
  const WorkbookHealth = TrainingToolWorkbookHealth;
  const ReportSheet = TrainingToolReportSheet;
  const COPY = runtime.copy;
  const state = runtime.state;
  const elements = runtime.elements;
  const renderers = runtime.renderers;
  const controls = runtime.controls;
  const projects = runtime.projects;
  const workbenchController = runtime.workbenchController;

  async function handleWorkbookChange(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const file = target.files && target.files[0];
    if (!file) {
      state.sourceFileName = "";
      state.workbook = null;
      state.analysis = null;
      state.workbookHealth = null;
      runtime.scheduleGapCheck.clear();
      runtime.personValidityQuery.rebuild();
      runtime.trainingCalendar.clear();
      projects.renderEmptyState();
      renderers.renderWorkbookHealth();
      controls.setStatus(COPY.defaultStatus);
      return;
    }

    controls.setBusy(true);
    controls.setStatus("正在读取总培训表并识别工作表...");

    try {
      const workbook = await Scanner.readWorkbookFile(file);
      const analysis = Scanner.analyzeWorkbook(workbook);
      const workbookHealth = WorkbookHealth.buildWorkbookHealth(workbook, analysis, Scanner);

      state.sourceFileName = file.name;
      state.workbook = workbook;
      state.analysis = analysis;
      state.workbookHealth = workbookHealth;
      state.updateSelectedProjects = [];
      state.workbenchResult = null;
      state.workbenchView = null;
      state.workbenchSelection = null;
      state.smartSchedulePlan = null;
      if (runtime.simulationSchedule) runtime.simulationSchedule.clearRecords();
      state.crmAnnualResult = null;
      elements.workbenchSearchInput.value = "";
      runtime.trainingCalendar.rebuild();

      renderers.renderWorkbookOverview();
      renderers.renderWorkbookHealth();
      renderers.renderValiditySheetOptions();
      projects.renderProjectGroups();
      projects.renderMonthSelect();
      renderers.renderWorkbenchFilterOptions(null);
      renderers.renderProjectCards();
      renderers.renderResultPlaceholders();
      renderers.renderCrmAnnual();
      runtime.personValidityQuery.rebuild();
      controls.clearPendingExport();
      controls.refreshButtons();

      state.workbenchResult = workbenchController.buildCurrentWorkbenchResult(analysis);
      workbenchController.renderWorkbenchView();
      renderers.renderQualificationPressure();
      renderers.renderTrainingLoad();
      renderers.renderSmartSchedule("", true);
      runtime.scheduleGapCheck.rebuild();

      controls.setStatus(`识别完成：人员信息表“${analysis.peopleInfo.name}”，共识别 ${analysis.projects.length} 个项目 sheet，${analysis.availableMonths.length} 个可选月份。`);
    } catch (error) {
      state.sourceFileName = "";
      state.workbook = null;
      state.analysis = null;
      state.workbookHealth = null;
      runtime.scheduleGapCheck.clear();
      runtime.personValidityQuery.rebuild();
      state.workbenchView = null;
      state.workbenchSelection = null;
      runtime.trainingCalendar.clear();
      if (runtime.simulationSchedule) runtime.simulationSchedule.clearRecords();
      state.crmAnnualResult = null;
      projects.renderEmptyState();
      renderers.renderWorkbookHealth();
      controls.setStatus(Utils.errorMessage(error, "工作簿读取失败。"), true);
    } finally {
      controls.setBusy(false);
    }
  }

  function validateUpdateSelection() {
    if (!state.analysis) {
      controls.setStatus("请先导入总培训表文件。", true);
      return null;
    }
    if (!elements.updateValiditySheetSelect.value) {
      controls.setStatus("请先确认人员信息表。", true);
      return null;
    }
    if (!state.updateSelectedProjects.length) {
      controls.setStatus("请先选择培训类型。", true);
      return null;
    }
    if (!elements.updateMonthSelect.value) {
      controls.setStatus("请先选择更新月份。", true);
      return null;
    }
    return {
      projectNames: [...state.updateSelectedProjects],
      monthKey: elements.updateMonthSelect.value
    };
  }

  async function handleUpdatePreview() {
    const selected = validateUpdateSelection();
    if (!selected) return;

    controls.setBusy(true);
    controls.clearPendingExport();
    controls.setStatus("正在生成有效期更新预览...");

    try {
      const workbook = Utils.deepClone(state.workbook) as TrainingToolWorkbook;
      const analysis = Scanner.analyzeWorkbook(workbook);
      const result = Validity.buildValidityUpdate(workbook, analysis, selected.projectNames, selected.monthKey);

      ReportSheet.attachUpdateReportSheet(
        workbook,
        analysis,
        result,
        selected.projectNames,
        [selected.monthKey]
      );

      renderers.renderActionResult("validity", result);
      controls.setPendingExport(
        workbook,
        Utils.buildOutputFileName(state.sourceFileName, "更新有效期"),
        "有效期更新预览",
        "导出有效期更新结果 Excel"
      );
      controls.setStatus("有效期更新预览已生成，确认无误后可导出 Excel。");
    } catch (error) {
      controls.clearPendingExport();
      controls.setStatus(Utils.errorMessage(error, "生成有效期更新预览失败。"), true);
    } finally {
      controls.setBusy(false);
    }
  }

  async function handleWorkbenchPreview() {
    if (!state.analysis) {
      controls.setStatus("请先导入总培训表文件。", true);
      return;
    }

    controls.setBusy(true);
    controls.clearPendingExport();
    controls.setStatus("正在扫描排班总览...");

    try {
      state.workbenchResult = workbenchController.buildCurrentWorkbenchResult(state.analysis);
      workbenchController.renderWorkbenchView();
      controls.setStatus("排班总览扫描完成。");
    } catch (error) {
      controls.setStatus(Utils.errorMessage(error, "排班总览扫描失败。"), true);
    } finally {
      controls.setBusy(false);
    }
  }

  function handleExport() {
    if (!state.pendingExport) {
      controls.setStatus("请先生成预览，再导出 Excel。", true);
      return;
    }

    try {
      XLSX.writeFile(state.pendingExport, state.pendingExportName);
      controls.setStatus(`${state.pendingExportLabel}已导出：${state.pendingExportName}`);
    } catch (error) {
      controls.setStatus(Utils.errorMessage(error, "导出 Excel 失败。"), true);
    }
  }

  function writeWorkbook(workbook: TrainingToolWorkbook, fileName: string, successLabel: string): void {
    XLSX.writeFile(workbook, fileName);
    controls.setStatus(`${successLabel}已导出：${fileName}`);
  }

  function handleExportWorkbenchView() {
    if (!state.workbenchView || !state.workbenchView.detailRows || !state.workbenchView.detailRows.length) {
      controls.setStatus("当前筛选总览没有可导出的人员。", true);
      return;
    }

    try {
      writeWorkbook(
        WorkbenchExport.buildWorkbook(state.workbenchView),
        Utils.buildOutputFileName(state.sourceFileName, "当前筛选总览"),
        "当前筛选总览"
      );
    } catch (error) {
      controls.setStatus(Utils.errorMessage(error, "导出当前筛选总览失败。"), true);
    }
  }

  function handleExportWorkbenchSelection() {
    if (!state.workbenchSelection || !state.workbenchSelection.rows || !state.workbenchSelection.rows.length) {
      controls.setStatus("请先点击项目风险矩阵中的数字，再导出人员明细。", true);
      return;
    }

    const { projectName, status } = state.workbenchSelection;
    try {
      writeWorkbook(
        WorkbenchExport.buildSelectionWorkbook(state.workbenchSelection),
        Utils.buildOutputFileName(state.sourceFileName, `${projectName}_${status}_人员明细`),
        "人员明细"
      );
    } catch (error) {
      controls.setStatus(Utils.errorMessage(error, "导出人员明细失败。"), true);
    }
  }

  function handleExportCrmMissing() {
    if (!state.crmAnnualResult || !state.crmAnnualResult.missingPeople || !state.crmAnnualResult.missingPeople.length) {
      controls.setStatus("当前年份没有可导出的 CRM 未参加人员。", true);
      return;
    }

    try {
      writeWorkbook(
        CrmExport.buildMissingWorkbook(state.crmAnnualResult),
        Utils.buildOutputFileName(state.sourceFileName, `CRM_${state.crmAnnualResult.year}_未参加人员`),
        "CRM未参加人员"
      );
    } catch (error) {
      controls.setStatus(Utils.errorMessage(error, "导出 CRM 未参加人员失败。"), true);
    }
  }

  runtime.actions = {
    handleWorkbookChange,
    handleUpdatePreview,
    handleWorkbenchPreview,
    handleExport,
    handleExportWorkbenchView,
    handleExportWorkbenchSelection,
    handleExportCrmMissing
  };
}
