export type QualificationSourceType = "personnel" | "portal";
export type PersonnelRole = "机长" | "副驾驶" | "";
export type QualificationIssueKind =
  | "missing-employee-id"
  | "missing-name"
  | "invalid-role"
  | "duplicate-qualification"
  | "invalid-qualification-code"
  | "name-mismatch";

export interface QualificationIssue {
  kind: QualificationIssueKind;
  message: string;
  source: QualificationSourceType;
  sheetName: string;
  rowNumber?: number;
  employeeId?: string;
  qualificationCode?: string;
}

export interface QualificationRecord {
  source: QualificationSourceType;
  employeeId: string;
  name: string;
  qualificationCode: string;
  personnelRole: PersonnelRole;
  sheetName: string;
  rowNumber: number;
}

export interface ParsedQualificationSource {
  source: QualificationSourceType;
  sheetName: string;
  headerRowNumber: number;
  qualificationCodes: string[];
  records: QualificationRecord[];
  issues: QualificationIssue[];
}

export type QualificationStatus = "双方一致" | "仅飞行门户" | "仅人员信息";

export interface QualificationSummary {
  qualificationCode: string;
  personnelCount: number;
  portalCount: number;
  matchedCount: number;
  portalOnlyCount: number;
  personnelOnlyCount: number;
  differenceCount: number;
}

export interface QualificationDetail {
  qualificationCode: string;
  employeeId: string;
  status: QualificationStatus;
  personnelName: string;
  portalName: string;
  personnelRole: PersonnelRole;
  personnelSource: string;
  portalSource: string;
  personnelRowNumber?: number;
  portalRowNumber?: number;
  nameMismatch: boolean;
}

export interface QualificationComparisonResult {
  qualificationCodes: string[];
  summaries: QualificationSummary[];
  details: QualificationDetail[];
  issues: QualificationIssue[];
  totals: {
    qualificationCount: number;
    matchedRelations: number;
    differenceRelations: number;
    affectedPeople: number;
    issueCount: number;
  };
}
