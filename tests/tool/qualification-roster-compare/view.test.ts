import { describe, expect, it } from "vitest";

import {
  ALL_QUALIFICATIONS_VALUE,
  filterQualificationDetails
} from "../../../src/tool/app/qualification-roster-compare/view";
import type { QualificationDetail } from "../../../src/tool/app/qualification-roster-compare/models";

function detail(qualificationCode: string, status: QualificationDetail["status"], employeeId: string): QualificationDetail {
  return {
    qualificationCode,
    employeeId,
    status,
    personnelName: "",
    portalName: "",
    personnelRole: "",
    personnelSource: "",
    portalSource: "",
    nameMismatch: false
  };
}

describe("qualification roster detail selection", () => {
  const details = [
    detail("EAMA", "双方一致", "100001"),
    detail("EAMA", "仅人员信息", "100002"),
    detail("RAMA", "仅飞行门户", "100003")
  ];

  it("shows all qualifications while retaining the difference filter", () => {
    expect(filterQualificationDetails(details, ALL_QUALIFICATIONS_VALUE, "diff").map((row) => row.employeeId))
      .toEqual(["100002", "100003"]);
  });

  it("shows every status across qualifications when both selectors are all", () => {
    expect(filterQualificationDetails(details, ALL_QUALIFICATIONS_VALUE, "all")).toEqual(details);
  });

  it("keeps a specific qualification selection scoped to that qualification", () => {
    expect(filterQualificationDetails(details, "EAMA", "all").map((row) => row.employeeId))
      .toEqual(["100001", "100002"]);
  });
});
