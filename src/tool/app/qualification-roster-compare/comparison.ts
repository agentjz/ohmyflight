import type {
  ParsedQualificationSource,
  QualificationComparisonResult,
  QualificationDetail,
  QualificationIssue,
  QualificationRecord,
  QualificationStatus,
  QualificationSummary
} from "./models";

function uniqueCodes(personnel: ParsedQualificationSource, portal: ParsedQualificationSource): string[] {
  return [...new Set([...personnel.qualificationCodes, ...portal.qualificationCodes])];
}

function sourceLabel(record: QualificationRecord | undefined): string {
  return record ? `${record.sheetName} 第${record.rowNumber}行` : "";
}

export function compareQualificationRosters(
  personnel: ParsedQualificationSource,
  portal: ParsedQualificationSource
): QualificationComparisonResult {
  const qualificationCodes = uniqueCodes(personnel, portal);
  const issues: QualificationIssue[] = [...personnel.issues, ...portal.issues];
  const details: QualificationDetail[] = [];
  const summaries: QualificationSummary[] = qualificationCodes.map((qualificationCode) => {
    const personnelRecords = personnel.records.filter((record) => record.qualificationCode === qualificationCode);
    const portalRecords = portal.records.filter((record) => record.qualificationCode === qualificationCode);
    const personnelMap = new Map(personnelRecords.map((record) => [record.employeeId, record]));
    const portalMap = new Map(portalRecords.map((record) => [record.employeeId, record]));
    const employeeIds = [...new Set([...personnelMap.keys(), ...portalMap.keys()])];
    let matchedCount = 0;
    let portalOnlyCount = 0;
    let personnelOnlyCount = 0;
    for (const employeeId of employeeIds) {
      const personnelRecord = personnelMap.get(employeeId);
      const portalRecord = portalMap.get(employeeId);
      let status: QualificationStatus;
      if (personnelRecord && portalRecord) {
        status = "双方一致";
        matchedCount += 1;
        if (personnelRecord.name !== portalRecord.name) {
          issues.push({ kind: "name-mismatch", message: `员工号 ${employeeId} 两侧姓名不一致。`, source: "portal", sheetName: portalRecord.sheetName, rowNumber: portalRecord.rowNumber, employeeId, qualificationCode });
        }
      } else if (portalRecord) {
        status = "仅飞行门户";
        portalOnlyCount += 1;
      } else {
        status = "仅人员信息";
        personnelOnlyCount += 1;
      }
      details.push({ qualificationCode, employeeId, status, personnelName: personnelRecord?.name || "", portalName: portalRecord?.name || "", personnelRole: personnelRecord?.personnelRole || "", personnelSource: sourceLabel(personnelRecord), portalSource: sourceLabel(portalRecord), personnelRowNumber: personnelRecord?.rowNumber, portalRowNumber: portalRecord?.rowNumber, nameMismatch: Boolean(personnelRecord && portalRecord && personnelRecord.name !== portalRecord.name) });
    }
    return { qualificationCode, personnelCount: personnelMap.size, portalCount: portalMap.size, matchedCount, portalOnlyCount, personnelOnlyCount, differenceCount: portalOnlyCount + personnelOnlyCount };
  });
  const statusOrder: Record<QualificationStatus, number> = { "仅飞行门户": 0, "仅人员信息": 1, "双方一致": 2 };
  details.sort((left, right) => statusOrder[left.status] - statusOrder[right.status] || left.qualificationCode.localeCompare(right.qualificationCode) || left.employeeId.localeCompare(right.employeeId));
  const differenceDetails = details.filter((detail) => detail.status !== "双方一致");
  return {
    qualificationCodes,
    summaries,
    details,
    issues,
    totals: { qualificationCount: qualificationCodes.length, matchedRelations: details.filter((detail) => detail.status === "双方一致").length, differenceRelations: differenceDetails.length, affectedPeople: new Set(differenceDetails.map((detail) => detail.employeeId)).size, issueCount: issues.length }
  };
}
