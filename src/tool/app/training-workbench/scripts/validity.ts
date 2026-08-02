import { TrainingToolRuleEngine } from "./rule-engine";
import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";
import type {
  TrainingToolAnalysis,
  TrainingToolPeopleIndex,
  TrainingToolPeopleInfo,
  TrainingToolProjectAnalysis,
  TrainingToolRecordedInfo,
  TrainingToolSheetRow,
  TrainingToolUpdatedRowEntry,
  TrainingToolWorkbook,
  TrainingValidityDetailRow,
  TrainingValidityResult,
  TrainingValiditySkippedRow
} from "./models";

const Utils = TrainingToolUtils;
  const RuleEngine = TrainingToolRuleEngine;
  const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;

  type ResolvedPeopleRow =
    | { error: string }
    | { rowIndex: number; row: TrainingToolSheetRow; matchedBy: string; error?: undefined };

  type ValidityRowToProcess = {
    row: TrainingToolSheetRow;
    startDate: Date | null;
    endDate: Date | null;
    rowMonthKey: string;
  };

  function resolvePeopleRow(updateRow: TrainingToolSheetRow, updateInfo: TrainingToolRecordedInfo, peopleInfo: TrainingToolPeopleInfo, peopleIndex: TrainingToolPeopleIndex): ResolvedPeopleRow {
    const name = Utils.normalizeText(Utils.getValueByHeader(updateRow, updateInfo, "姓名"));
    const employeeId = Utils.normalizeText(Utils.getValueByHeader(updateRow, updateInfo, "员工号"));
    const nameMatches = name ? (peopleIndex.byName.get(name) || []) : [];

    if (nameMatches.length === 1) {
      const targetRow = peopleInfo.rows[nameMatches[0]]!;
      const targetEmployeeId = Utils.normalizeText(targetRow.cells[peopleIndex.employeeColumnIndex]);
      if (employeeId && targetEmployeeId && targetEmployeeId !== employeeId) {
        return {
          error: `姓名命中，但员工号不一致（人员信息表：${targetEmployeeId}）。`
        };
      }
      return {
        rowIndex: nameMatches[0],
        row: targetRow,
        matchedBy: "姓名"
      };
    }

    if (nameMatches.length > 1) {
      if (!employeeId) {
        return { error: "人员信息表中存在重名，且项目 sheet 的更新记录缺少员工号，无法唯一定位。" };
      }
      const narrowed = nameMatches.filter((index) => {
        const targetRow = peopleInfo.rows[index]!;
        return Utils.normalizeText(targetRow.cells[peopleIndex.employeeColumnIndex]) === employeeId;
      });
      if (narrowed.length === 1) {
        return {
          rowIndex: narrowed[0],
          row: peopleInfo.rows[narrowed[0]]!,
          matchedBy: "姓名 + 员工号"
        };
      }
      return { error: "人员信息表中存在重名，员工号也无法唯一确认。" };
    }

    const idMatches = employeeId ? (peopleIndex.byId.get(employeeId) || []) : [];
    if (idMatches.length === 1) {
      return {
        rowIndex: idMatches[0],
        row: peopleInfo.rows[idMatches[0]]!,
        matchedBy: "员工号二次验证"
      };
    }
    if (idMatches.length > 1) {
      return { error: "员工号命中多行，无法唯一定位。" };
    }

    return { error: "未在人员信息表中找到对应人员。" };
  }

  function registerUpdatedRow(updatedRowMap: Map<number, TrainingToolUpdatedRowEntry>, rowNumber: number, columnIndex: number, record: TrainingValidityDetailRow): void {
    const current = updatedRowMap.get(rowNumber) || {
      rowNumber,
      employeeId: record.employeeId,
      name: record.name,
      columns: new Set<number>(),
      records: [] as TrainingValidityDetailRow[]
    };
    current.columns.add(columnIndex);
    current.records.push(record);
    updatedRowMap.set(rowNumber, current);
  }

  function normalizeProjectNames(projectNames: string | string[]): string[] {
    const names = Array.isArray(projectNames) ? projectNames : [projectNames];
    return [...new Set(names.map((name) => Utils.normalizeText(name)).filter(Boolean))];
  }

  function resolveSelectedProjects(analysis: TrainingToolAnalysis, projectNames: string | string[]): TrainingToolProjectAnalysis[] {
    const selectedNames = normalizeProjectNames(projectNames);
    if (!selectedNames.length) {
      throw new Error("请先选择培训类型。");
    }

    return selectedNames.map((projectName) => {
      const project = analysis.projectMap.get(projectName);
      if (!project) {
        throw new Error(`未找到对应的培训类型：${projectName}`);
      }
      if (project.peopleColumnIndex < 0) {
        throw new Error(`人员信息表中缺少对应培训类型列：${projectName}`);
      }
      if (!project.validityUpdateInfo || !project.validityUpdateInfo.rows.length) {
        throw new Error(`项目 sheet 中没有“机器看=Y”的有效期更新记录：${projectName}`);
      }
      return project;
    });
  }

  function buildRowsToProcess(project: TrainingToolProjectAnalysis, monthKey: string): ValidityRowToProcess[] {
    return project.validityUpdateInfo.rows
      .map((row) => ({
        row,
        startDate: Utils.parseDate(Utils.getValueByHeader(row, project.validityUpdateInfo, "培训开始日期")),
        endDate: Utils.parseDate(Utils.getValueByHeader(row, project.validityUpdateInfo, "培训结束日期")),
        rowMonthKey: Utils.toMonthKey(Utils.getValueByHeader(row, project.validityUpdateInfo, "培训开始日期"))
          || Utils.toMonthKey(Utils.getValueByHeader(row, project.validityUpdateInfo, "培训结束日期"))
      }))
      .filter((item) => item.rowMonthKey === monthKey)
      .sort((left, right) => {
        const leftTime = left.startDate ? left.startDate.getTime() : 0;
        const rightTime = right.startDate ? right.startDate.getTime() : 0;
        return leftTime - rightTime || left.row.rowNumber - right.row.rowNumber;
      });
  }

  function buildSkippedRow(projectName: string, name: string, status: string, reason: string): TrainingValiditySkippedRow {
    return {
      projectName,
      name,
      status,
      reason
    };
  }

  function buildValidityUpdate(workbook: TrainingToolWorkbook, analysis: TrainingToolAnalysis, projectNames: string | string[], monthKey: string): TrainingValidityResult {
    const peopleInfo = analysis.peopleInfo;
    const peopleSheet = workbook.Sheets[peopleInfo.name]!;
    const selectedProjects = resolveSelectedProjects(analysis, projectNames);
    const today = RuleEngine.createTodayDate();

    const detailRows: TrainingValidityDetailRow[] = [];
    const skippedRows: TrainingValiditySkippedRow[] = [];
    const updatedRowMap = new Map<number, TrainingToolUpdatedRowEntry>();
    let matchedRecordedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let rollbackCount = 0;
    let invalidCount = 0;
    let skippedCount = 0;

    selectedProjects.forEach((project) => {
      const rowsToProcess = buildRowsToProcess(project, monthKey);

      rowsToProcess.forEach((item) => {
        matchedRecordedCount += 1;

        const row = item.row;
        const employeeId = Utils.normalizeText(Utils.getValueByHeader(row, project.validityUpdateInfo, "员工号"));
        const name = Utils.normalizeText(Utils.getValueByHeader(row, project.validityUpdateInfo, "姓名"));
        const recordState = TrainingRecordPolicy.classifyForValidityUpdate(row, project.validityUpdateInfo);

        if (recordState.abnormal) {
          skippedRows.push(buildSkippedRow(project.canonical, name, "记录异常", recordState.reason));
          skippedCount += 1;
          return;
        }

        if (!recordState.markedForUpdate) {
          skippedRows.push(buildSkippedRow(project.canonical, name, "不参与更新", "机器看不是“Y”，本次跳过。"));
          skippedCount += 1;
          return;
        }

        if (!item.startDate) {
          skippedRows.push(buildSkippedRow(project.canonical, name, "日期异常", "培训开始日期无法解析。"));
          skippedCount += 1;
          return;
        }

        const target = resolvePeopleRow(row, project.validityUpdateInfo, peopleInfo, analysis.peopleIndex);
        if (target.error) {
          skippedRows.push(buildSkippedRow(project.canonical, name, "匹配失败", target.error));
          skippedCount += 1;
          return;
        }
        const matchedTarget = target as Extract<ResolvedPeopleRow, { row: TrainingToolSheetRow }>;

        const oldRaw = matchedTarget.row.cells[project.peopleColumnIndex];
        const oldExpiry = Utils.parseDate(oldRaw);
        const oldExpiryText = Utils.formatDate(oldExpiry) || Utils.normalizeText(oldRaw) || "无";
        const computed = RuleEngine.computeExpiry(project.rule, item.startDate, oldExpiry);
        const judgement = RuleEngine.classifyUpdateJudgement(project.rule, item.startDate, oldExpiry);
        const outcome = RuleEngine.evaluateUpdateResult(oldExpiry, computed.newExpiry, today);
        const newExpiryText = Utils.formatDate(computed.newExpiry);
        const reasonParts = [
          `匹配方式：${matchedTarget.matchedBy}`,
          computed.reason,
          outcome.reason
        ].filter(Boolean);

        detailRows.push({
          projectName: project.canonical,
          sheetName: project.sheetName,
          rowNumber: row.rowNumber,
          employeeId,
          name,
          oldExpiry: oldExpiryText,
          newExpiry: newExpiryText,
          judgement,
          result: outcome.result,
          reason: reasonParts.join("；")
        });

        if (outcome.result === "不变") {
          unchangedCount += 1;
          return;
        }

        if (outcome.result === "有效期回退") {
          rollbackCount += 1;
          return;
        }

        if (outcome.result === "更新无效") {
          invalidCount += 1;
          return;
        }

        Utils.writeDateCell(peopleSheet, matchedTarget.row.rowNumber, project.peopleColumnIndex, computed.newExpiry);
        matchedTarget.row.cells[project.peopleColumnIndex] = Utils.cloneDate(computed.newExpiry);
        updatedCount += 1;

        registerUpdatedRow(updatedRowMap, matchedTarget.row.rowNumber, project.peopleColumnIndex, {
          projectName: project.canonical,
          sheetName: project.sheetName,
          rowNumber: row.rowNumber,
          employeeId,
          name,
          oldExpiry: oldExpiryText,
          newExpiry: newExpiryText,
          judgement,
          result: outcome.result,
          reason: reasonParts.join("；")
        });
      });
    });

    const selectedProjectNames = selectedProjects.map((project) => project.canonical);
    const selectedProjectLabel = selectedProjectNames.join("、");

    return {
      summaryText: `已按 ${monthKey} 机器看Y记录生成预览：覆盖 ${selectedProjectNames.length} 个培训类型（${selectedProjectLabel}），命中 ${matchedRecordedCount} 条，已更新 ${updatedCount} 条，不变 ${unchangedCount} 条，有效期回退 ${rollbackCount} 条，更新无效 ${invalidCount} 条，跳过 ${skippedCount} 条。`,
      statsCards: [
        { label: "培训类型", value: selectedProjectNames.length },
        { label: "命中机器看Y", value: matchedRecordedCount },
        { label: "已更新", value: updatedCount },
        { label: "不变", value: unchangedCount },
        { label: "有效期回退", value: rollbackCount },
        { label: "更新无效", value: invalidCount },
        { label: "跳过", value: skippedCount }
      ],
      detailColumns: ["项目", "项目 sheet", "项目行号", "员工号", "姓名", "旧有效期", "新有效期", "判断", "处理结果", "说明"],
      detailRows,
      skippedColumns: ["项目", "姓名", "状态", "原因"],
      skippedRows,
      updatedRowMap,
      updatedRecords: detailRows.filter((row) => row.result === "已更新")
    };
  }
  export const TrainingToolValidity = {
    buildValidityUpdate
  };
