import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";

import { resolveFromRoot } from "../../helpers/paths";

const appPath = resolveFromRoot("src", "tool", "app", "personnel-structure-stats", "app.py");

function runPython(script: string): string {
  return execFileSync("python", ["-X", "utf8", "-c", script], {
    cwd: resolveFromRoot(),
    encoding: "utf8"
  });
}

function escapePythonPath(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\");
}

function sampleRows(): unknown[][] {
  return [
    ["姓名", "员工号", "技术信息", "原单位", "检查员资格", "RAMA", "REUO", "RWAS", "EAMA", "EEUO", "EWAS", "是否运行"],
    ["教员甲", "100001", "777:飞行教员A", "总队777", "公司检查员", 1, 1, 1, 1, 1, 1, "否"],
    ["机长乙", "100002", "777:B类机长", "777返聘", "", "", "", "", 1, "", 1, "是"],
    ["机长丙", "100003", "777:Z类机长", "河南分公司", "", "", "", "", "", "", "", "是"],
    ["转机丁", "100004", "划转机长", "湖北分公司", "", "", "", "", "", "", "", "否"],
    ["副驾戊", "100005", "777:A2类副驾驶", "总队777", "", "", "", "", 1, 1, "", "是"],
    ["转机己", "100006", "划转副驾驶", "新疆分公司（借）", "", "", "", "", "", "", "", "否"],
    ["机长庚", "100007", "777:D类机长", "火星分公司", "", "", "", "", "", "", "", "否"],
    ["副驾辛", "100008", "777:E类副驾驶", "上海分公司（借）", "", "", "", "", "", 1, "", "否"]
  ];
}

function createSampleWorkbook(filePath: string): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sampleRows()), "人员信息");
  XLSX.writeFile(workbook, filePath);
}

function createTemplateDocx(filePath: string): void {
  runPython(`
from docx import Document

path = r"${escapePythonPath(filePath)}"
doc = Document()

titles = [
    "飞行管理人员占比（999人）",
    "教员、机长、副驾驶占比（旧母数）",
    "机长含以上各级别占比（旧母数）",
    "机长航线资格占比（旧母数不含转机型）",
    "机长报务占比（旧母数不含转机型）",
    "副驾驶级别占比（旧母数）",
    "副驾驶报务占比（旧母数不含转机型）",
    "人员居住情况（旧母数）",
    "空勤人员原单位情况（旧母数）",
]
for title in titles:
    doc.add_paragraph(title)

simple_headers = ["", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "本月变化", "本月占比"]
group_headers = ["", "", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "本月变化", "本月占比"]

def add_simple_table(labels):
    table = doc.add_table(rows=1, cols=len(simple_headers))
    for index, value in enumerate(simple_headers):
        table.rows[0].cells[index].text = value
    for label in labels:
        row = table.add_row()
        row.cells[0].text = label
        for cell in row.cells[1:]:
            cell.text = "old"
    return table

def add_group_table(rows):
    table = doc.add_table(rows=1, cols=len(group_headers))
    for index, value in enumerate(group_headers):
        table.rows[0].cells[index].text = value
    for group, label in rows:
        row = table.add_row()
        row.cells[0].text = group
        row.cells[1].text = label
        for cell in row.cells[2:]:
            cell.text = "old"
    return table

management = add_simple_table(["管理人员", "非管理人员"])
management.rows[1].cells[7].text = "KEEP"
add_simple_table(["教员", "机长", "副驾驶"])
add_group_table([
    ("", "检查员"),
    ("教员", "C类教员"),
    ("教员", "B类教员"),
    ("教员", "A类教员"),
    ("机长", "D类机长"),
    ("机长", "C类机长"),
    ("机长", "B类机长"),
    ("机长", "Z类机长"),
    ("机长", "在训机长"),
])
add_simple_table(["美+欧+西亚", "美+欧", "美+西亚", "欧+西亚", "仅北美带队", "仅欧洲带队", "仅西亚带队", "航线机长", "左座带飞"])
add_simple_table(["美+欧+西亚", "美+欧", "美+西亚", "欧+西亚", "单美洲报务", "单欧洲报务", "单西亚报务", "无报务"])
add_simple_table(["D类副驾驶", "C类副驾驶", "B类副驾驶", "A类副驾驶", "转机型副驾驶"])
add_simple_table(["美+欧+西亚", "美+欧", "美+西亚", "欧+西亚", "单美洲报务", "单欧洲报务", "单西亚报务", "无报务"])
add_group_table([
    ("机长", "本地居住"),
    ("机长", "异地居住"),
    ("副驾驶", "本地居住"),
    ("副驾驶", "异地居住"),
])
add_group_table([
    ("飞行 / 总队", "777"),
    ("飞行 / 总队", "737"),
    ("飞行 / 总队", "320"),
    ("飞行 / 总队", "909"),
    ("湖南", "湖南"),
    ("湖北", "湖北"),
    ("新疆", "新疆"),
    ("河南", "河南"),
    ("西安", "西安"),
    ("重庆", "重庆"),
    ("汕头", "汕头"),
    ("珠海", "珠海"),
    ("广西", "广西"),
    ("海南", "海南"),
    ("上海", "上海"),
])

doc.save(path)
`);
}

function readDocx(filePath: string): { paragraphs: string[]; tables: string[][][] } {
  return JSON.parse(runPython(`
import json
from docx import Document

doc = Document(r"${escapePythonPath(filePath)}")
print(json.dumps({
    "paragraphs": [paragraph.text for paragraph in doc.paragraphs],
    "tables": [
        [[cell.text for cell in row.cells] for row in table.rows]
        for table in doc.tables
    ],
}, ensure_ascii=False))
`)) as { paragraphs: string[]; tables: string[][][] };
}

function rowMap(table: string[][], labelColumn = 0): Map<string, string[]> {
  return new Map(table.slice(1).map((row) => [row[labelColumn], row]));
}

function numberAt(row: string[], column: number): number {
  return Number.parseInt(row[column], 10) || 0;
}

function percentAt(row: string[]): number {
  return Number.parseInt(row.at(-1) || "", 10) || 0;
}

describe("personnel structure docx app", () => {
  it("calculates the same closed hierarchy as the browser logic", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "personnel-calc-"));
    const excelPath = path.join(tempDir, "personnel.xlsx");
    createSampleWorkbook(excelPath);

    const output = runPython(`
import importlib.util
import json
from pathlib import Path
import sys

path = Path(r"${escapePythonPath(appPath)}")
spec = importlib.util.spec_from_file_location("personnel_app", path)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

records = module.parse_excel(Path(r"${escapePythonPath(excelPath)}"))
result = module.calculate(records)
print(json.dumps({
    "structure": result.structure_crew_count,
    "captain": result.captain_or_above_count,
    "first_officer": result.first_officer_count,
    "closed": [section.closed for section in result.sections],
    "titles": [section.title for section in result.sections],
}, ensure_ascii=False))
`);

    expect(JSON.parse(output)).toEqual({
      structure: 8,
      captain: 5,
      first_officer: 3,
      closed: Array(8).fill(true),
      titles: [
        "教员、机长、副驾驶占比",
        "机长含以上各级别占比",
        "机长航线资格占比",
        "机长报务占比",
        "副驾驶级别占比",
        "副驾驶报务占比",
        "人员居住情况",
        "空勤人员原单位情况"
      ]
    });
  });

  it("fills a separate closed Word report and leaves management untouched", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "personnel-docx-"));
    const excelPath = path.join(tempDir, "personnel.xlsx");
    const templatePath = path.join(tempDir, "template.docx");
    const outputPath = path.join(tempDir, "filled.docx");
    createSampleWorkbook(excelPath);
    createTemplateDocx(templatePath);

    execFileSync("python", [
      "-X",
      "utf8",
      appPath,
      "--excel",
      excelPath,
      "--docx",
      templatePath,
      "--month",
      "7",
      "--output",
      outputPath
    ], {
      cwd: resolveFromRoot(),
      stdio: "pipe"
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    const original = readDocx(templatePath);
    const report = readDocx(outputPath);
    expect(original.tables[0][1][7]).toBe("KEEP");
    expect(report.tables[0][1][7]).toBe("KEEP");
    expect(report.paragraphs).toContain("飞行管理人员占比（999人）");

    expect(report.paragraphs).toEqual(expect.arrayContaining([
      "教员、机长、副驾驶占比（8人）",
      "机长含以上各级别占比（5人）",
      "机长航线资格占比（4人不含转机型）",
      "机长报务占比（4人不含转机型）",
      "副驾驶级别占比（3人）",
      "副驾驶报务占比（2人不含转机型）",
      "人员居住情况（8人）",
      "空勤人员原单位情况（8人）"
    ]));

    const role = rowMap(report.tables[1]);
    const captainLevel = rowMap(report.tables[2], 1);
    const captainRoute = rowMap(report.tables[3]);
    const captainCommunication = rowMap(report.tables[4]);
    const firstOfficerLevel = rowMap(report.tables[5]);
    const firstOfficerCommunication = rowMap(report.tables[6]);
    const residenceRows = report.tables[7].slice(1);
    const originRows = report.tables[8].slice(1);

    expect(captainLevel.has("转机型机长")).toBe(true);
    expect(captainRoute.get("其他")?.[7]).toBe("1");
    expect(firstOfficerLevel.get("E类副驾驶")?.[7]).toBe("1");

    expect([...role.values()].reduce((sum, row) => sum + numberAt(row, 7), 0)).toBe(8);
    expect([...captainLevel.entries()].filter(([label]) => label !== "检查员").reduce((sum, [, row]) => sum + numberAt(row, 8), 0)).toBe(5);
    expect([...captainRoute.values()].reduce((sum, row) => sum + numberAt(row, 7), 0)).toBe(4);
    expect([...captainCommunication.values()].reduce((sum, row) => sum + numberAt(row, 7), 0)).toBe(4);
    expect([...firstOfficerLevel.values()].reduce((sum, row) => sum + numberAt(row, 7), 0)).toBe(3);
    expect([...firstOfficerCommunication.values()].reduce((sum, row) => sum + numberAt(row, 7), 0)).toBe(2);
    expect(residenceRows.reduce((sum, row) => sum + numberAt(row, 8), 0)).toBe(8);
    expect(originRows.reduce((sum, row) => sum + numberAt(row, 8), 0)).toBe(8);

    expect([...role.values()].reduce((sum, row) => sum + percentAt(row), 0)).toBe(100);
    expect([...captainLevel.entries()].filter(([label]) => label !== "检查员").reduce((sum, [, row]) => sum + percentAt(row), 0)).toBe(100);
    expect([...captainRoute.values()].reduce((sum, row) => sum + percentAt(row), 0)).toBe(100);
    expect([...captainCommunication.values()].reduce((sum, row) => sum + percentAt(row), 0)).toBe(100);
    expect([...firstOfficerLevel.values()].reduce((sum, row) => sum + percentAt(row), 0)).toBe(100);
    expect([...firstOfficerCommunication.values()].reduce((sum, row) => sum + percentAt(row), 0)).toBe(100);
    expect(residenceRows.slice(0, 2).reduce((sum, row) => sum + percentAt(row), 0)).toBe(100);
    expect(residenceRows.slice(2).reduce((sum, row) => sum + percentAt(row), 0)).toBe(100);
    expect(originRows.reduce((sum, row) => sum + percentAt(row), 0)).toBe(100);

    const simpleTableIndexes = [1, 3, 4, 5, 6];
    simpleTableIndexes.forEach((tableIndex) => {
      report.tables[tableIndex].slice(1).forEach((row) => {
        expect([row[7], row[8], row[9]]).not.toContain("old");
      });
    });
    const groupedTableIndexes = [2, 7, 8];
    groupedTableIndexes.forEach((tableIndex) => {
      report.tables[tableIndex].slice(1).forEach((row) => {
        expect([row[8], row[9], row[10]]).not.toContain("old");
      });
    });
    expect(report.tables[1][1][6]).toBe("old");
  }, 30000);

  it("opens the tkinter gui when app.py runs without arguments", () => {
    const output = runPython(`
import importlib.util
from pathlib import Path
import sys

path = Path(r"${escapePythonPath(appPath)}")
spec = importlib.util.spec_from_file_location("personnel_app", path)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

called = {}
def fake_gui():
    called["ok"] = True
    return 0

module.run_gui = fake_gui
code = module.main([])
print(code)
print(called.get("ok"))
`);
    expect(output).toContain("0");
    expect(output).toContain("True");
  });
});
