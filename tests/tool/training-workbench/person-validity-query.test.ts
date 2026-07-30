import { beforeAll, describe, expect, it } from "vitest";

import { loadBrowserScripts } from "../../helpers/browser-context";

const HEADERS = [
  "员工号", "姓名", "分部", "技术信息", "熟练检查", "应急训练", "危险品", "航空安保", "TSA",
  "疲劳管理", "飞行作风", "英语能力", "汉语能力", "机长年度", "120-100", "型别更新", "体检合格证", "三类"
];

function analysisFixture() {
  const rows = [
    {
      rowNumber: 2,
      cells: [
        "100001", "张三", "一分部", "777:C类机长", "2026-08-31", "2026-07-01", "已完成", "不适用", "",
        "2026-12-31", "2027-01-31", "2028-02-29", "不适用", "2026-06-30", "已完成", "2027-03-31", "2026-09-30", 1
      ]
    },
    {
      rowNumber: 3,
      cells: [
        "100002", "张小三", "二分部", "777:C类副驾驶", "2027-08-31", "2027-07-01", "2027-09-01", "2027-10-01", "2027-11-01",
        "2027-12-01", "2028-01-01", "2028-02-01", "2028-03-01", "", "", "", "2027-09-30", 2
      ]
    }
  ];
  return {
    peopleInfo: {
      name: "人员信息表",
      headers: HEADERS,
      headerMap: new Map(HEADERS.map((header, index) => [header, index])),
      rows
    }
  };
}

describe("training workbench person validity query", () => {
  let query: any;

  beforeAll(() => {
    const context = loadBrowserScripts([
      "tool/app/training-workbench/scripts/config.js",
      "tool/app/training-workbench/scripts/utils.js",
      "tool/app/training-workbench/scripts/person-validity-query.js"
    ]);
    query = (context as any).TrainingTool.PersonValidityQuery;
  });

  it("returns every validity column and keeps date, text, and empty values distinct", () => {
    const index = query.buildIndex(analysisFixture(), "2026-07-30");
    const [person] = query.search(index, "100001");

    expect(person.name).toBe("张三");
    expect(person.validities).toHaveLength(13);
    expect(person.validities[0]).toMatchObject({ name: "熟练检查", value: "2026-08-31", state: "valid" });
    expect(person.validities[1]).toMatchObject({ name: "应急训练", value: "2026-07-01", state: "expired" });
    expect(person.validities[2]).toMatchObject({ name: "危险品", value: "已完成", state: "text" });
    expect(person.validities[4]).toMatchObject({ name: "TSA", value: "未填写", state: "empty" });
    expect(person.validities[12].name).toBe("体检合格证");
  });

  it("prefers exact employee or name matches and supports partial search", () => {
    const index = query.buildIndex(analysisFixture(), "2026-07-30");

    expect(query.search(index, "张三").map((person: any) => person.employeeId)).toEqual(["100001"]);
    expect(query.search(index, "100002").map((person: any) => person.name)).toEqual(["张小三"]);
    expect(query.search(index, "张")).toHaveLength(2);
  });
});
