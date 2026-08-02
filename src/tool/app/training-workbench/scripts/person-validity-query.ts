import { TrainingToolUtils } from "./utils";
import type { TrainingToolAnalysis, TrainingToolPeopleInfo } from "./models";

const Utils = TrainingToolUtils;
  const FIRST_VALIDITY_HEADER = "熟练检查";
  const LAST_VALIDITY_HEADER = "体检合格证";

  type ValidityState = "valid" | "expired" | "text" | "empty";

  export interface PersonValidityItem {
    name: string;
    value: string;
    state: ValidityState;
    stateLabel: string;
  }

  export interface PersonValidityRecord {
    key: string;
    rowNumber: number;
    employeeId: string;
    name: string;
    department: string;
    technicalInfo: string;
    validities: PersonValidityItem[];
  }

  export interface PersonValidityIndex {
    people: PersonValidityRecord[];
    byEmployeeId: Map<string, PersonValidityRecord[]>;
    byName: Map<string, PersonValidityRecord[]>;
  }

  function validityColumns(peopleInfo: Pick<TrainingToolPeopleInfo, "headers" | "headerMap">): Array<{ name: string; index: number }> {
    const start = Utils.findHeaderIndex(peopleInfo, FIRST_VALIDITY_HEADER);
    const end = Utils.findHeaderIndex(peopleInfo, LAST_VALIDITY_HEADER);
    if (start < 0 || end < start) {
      throw new Error(`人员信息表必须包含从“${FIRST_VALIDITY_HEADER}”到“${LAST_VALIDITY_HEADER}”的有效期列。`);
    }
    return peopleInfo.headers
      .map((name, index) => ({ name: Utils.normalizeText(name), index }))
      .slice(start, end + 1)
      .filter((column) => Boolean(column.name));
  }

  function dayValue(value: Date): number {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0).getTime();
  }

  function buildValidityItem(name: string, rawValue: unknown, today: Date): PersonValidityItem {
    const expiry = Utils.parseDate(rawValue);
    if (expiry) {
      const expired = dayValue(expiry) < dayValue(today);
      return {
        name,
        value: Utils.formatDate(expiry),
        state: expired ? "expired" : "valid",
        stateLabel: expired ? "已过期" : "有效"
      };
    }
    const text = Utils.normalizeText(rawValue);
    return text
      ? { name, value: text, state: "text", stateLabel: "原表值" }
      : { name, value: "未填写", state: "empty", stateLabel: "未填写" };
  }

  function pushIndex(
    target: Map<string, PersonValidityRecord[]>,
    key: string,
    person: PersonValidityRecord
  ): void {
    if (!key) return;
    const values = target.get(key) || [];
    values.push(person);
    target.set(key, values);
  }

  function buildIndex(
    analysis: { peopleInfo: Pick<TrainingToolPeopleInfo, "name" | "headers" | "headerMap" | "rows"> },
    todayValue: unknown = new Date()
  ): PersonValidityIndex {
    const peopleInfo = analysis.peopleInfo;
    const columns = validityColumns(peopleInfo);
    const today = Utils.parseDate(todayValue) || new Date();
    const employeeIndex = Utils.findHeaderIndex(peopleInfo, "员工号");
    const nameIndex = Utils.findHeaderIndex(peopleInfo, "姓名");
    const departmentIndex = Utils.findHeaderIndex(peopleInfo, "分部");
    const technicalInfoIndex = Utils.findHeaderIndex(peopleInfo, "技术信息");

    const people = peopleInfo.rows.flatMap((row) => {
      const employeeId = employeeIndex >= 0 ? Utils.normalizeText(row.cells[employeeIndex]) : "";
      const name = nameIndex >= 0 ? Utils.normalizeText(row.cells[nameIndex]) : "";
      if (!employeeId && !name) return [];
      return [{
        key: String(row.rowNumber),
        rowNumber: row.rowNumber,
        employeeId,
        name,
        department: departmentIndex >= 0 ? Utils.normalizeText(row.cells[departmentIndex]) : "",
        technicalInfo: technicalInfoIndex >= 0 ? Utils.normalizeText(row.cells[technicalInfoIndex]) : "",
        validities: columns.map((column) => buildValidityItem(column.name, row.cells[column.index], today))
      }];
    });
    const byEmployeeId = new Map<string, PersonValidityRecord[]>();
    const byName = new Map<string, PersonValidityRecord[]>();
    people.forEach((person) => {
      pushIndex(byEmployeeId, person.employeeId, person);
      pushIndex(byName, person.name, person);
    });
    return { people, byEmployeeId, byName };
  }

  function search(index: PersonValidityIndex, queryValue: unknown): PersonValidityRecord[] {
    const query = Utils.normalizeText(queryValue);
    if (!query) return [];
    const exactById = index.byEmployeeId.get(query);
    if (exactById?.length) return [...exactById];
    const exactByName = index.byName.get(query);
    if (exactByName?.length) return [...exactByName];
    const normalizedQuery = query.toLocaleLowerCase("zh-CN");
    return index.people.filter((person) => (
      person.employeeId.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
      || person.name.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
    ));
  }
  export const TrainingToolPersonValidityQuery = {
    FIRST_VALIDITY_HEADER,
    LAST_VALIDITY_HEADER,
    buildIndex,
    search
  };
