import { describe, expect, it } from "vitest";

import { compareQualificationRosters } from "../../../src/tool/app/qualification-roster-compare/comparison";
import type {
  ParsedQualificationSource,
  QualificationRecord
} from "../../../src/tool/app/qualification-roster-compare/models";

function record(
  source: "personnel" | "portal",
  qualificationCode: string,
  employeeId: string,
  name: string,
  rowNumber: number,
  personnelRole: "机长" | "副驾驶" | "" = ""
): QualificationRecord {
  return {
    source,
    qualificationCode,
    employeeId,
    name,
    personnelRole,
    sheetName: source === "personnel" ? "人员信息" : "运行资质人员名册",
    rowNumber
  };
}

function source(
  sourceType: "personnel" | "portal",
  qualificationCodes: string[],
  records: QualificationRecord[]
): ParsedQualificationSource {
  return {
    source: sourceType,
    sheetName: sourceType === "personnel" ? "人员信息" : "运行资质人员名册",
    headerRowNumber: 1,
    qualificationCodes,
    records,
    issues: []
  };
}

describe("qualification roster comparison", () => {
  it("classifies each qualification by employee id and keeps personnel role as context", () => {
    const personnel = source("personnel", ["EAMA", "REUO"], [
      record("personnel", "EAMA", "100001", "张三", 2, "机长"),
      record("personnel", "EAMA", "100002", "李四", 3, "副驾驶"),
      record("personnel", "REUO", "100003", "王五", 4, "机长")
    ]);
    const portal = source("portal", ["EAMA", "RAMA"], [
      record("portal", "EAMA", "100001", "张三", 2),
      record("portal", "EAMA", "100004", "赵六", 3),
      record("portal", "RAMA", "100005", "钱七", 4)
    ]);

    const result = compareQualificationRosters(personnel, portal);

    expect(result.qualificationCodes).toEqual(["EAMA", "REUO", "RAMA"]);
    expect(result.summaries).toEqual([
      {
        qualificationCode: "EAMA",
        personnelCount: 2,
        portalCount: 2,
        matchedCount: 1,
        portalOnlyCount: 1,
        personnelOnlyCount: 1,
        differenceCount: 2
      },
      {
        qualificationCode: "REUO",
        personnelCount: 1,
        portalCount: 0,
        matchedCount: 0,
        portalOnlyCount: 0,
        personnelOnlyCount: 1,
        differenceCount: 1
      },
      {
        qualificationCode: "RAMA",
        personnelCount: 0,
        portalCount: 1,
        matchedCount: 0,
        portalOnlyCount: 1,
        personnelOnlyCount: 0,
        differenceCount: 1
      }
    ]);
    expect(result.totals).toEqual({
      qualificationCount: 3,
      matchedRelations: 1,
      differenceRelations: 4,
      affectedPeople: 4,
      issueCount: 0
    });
    expect(result.details.find((row) => row.employeeId === "100002")).toEqual(expect.objectContaining({
      status: "仅人员信息",
      personnelRole: "副驾驶",
      personnelName: "李四",
      portalName: ""
    }));
    expect(result.details.find((row) => row.employeeId === "100004")).toEqual(expect.objectContaining({
      status: "仅飞行门户",
      personnelRole: "",
      personnelName: "",
      portalName: "赵六"
    }));
  });

  it("matches the same employee id while reporting different names", () => {
    const personnel = source("personnel", ["EAMA"], [
      record("personnel", "EAMA", "100001", "张三", 2, "机长")
    ]);
    const portal = source("portal", ["EAMA"], [
      record("portal", "EAMA", "100001", "张叁", 2)
    ]);

    const result = compareQualificationRosters(personnel, portal);

    expect(result.details[0]).toEqual(expect.objectContaining({
      status: "双方一致",
      personnelName: "张三",
      portalName: "张叁",
      nameMismatch: true
    }));
    expect(result.issues).toEqual([
      expect.objectContaining({ kind: "name-mismatch", employeeId: "100001", qualificationCode: "EAMA" })
    ]);
  });
});
