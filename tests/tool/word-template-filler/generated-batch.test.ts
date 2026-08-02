import vm from "node:vm";

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";

import { AppPackager } from "../../../src/tool/app/word-template-filler/app-packager";
import { GeneratedAppScript } from "../../../src/tool/app/word-template-filler/generated-app-script";
import { HtmlGenerator } from "../../../src/tool/app/word-template-filler/html-generator";
import type { WordTemplateAppConfig } from "../../../src/tool/app/word-template-filler/models";
import { createBrowserContext } from "../../helpers/browser-context";

function loadGeneratedHtml(config: WordTemplateAppConfig): string {
  return HtmlGenerator.generate(config, "测试应用", "template.docx");
}

function loadInstructions(): string {
  return AppPackager.generateInstructions("测试应用", "测试应用", "template.docx");
}

function buildPackagedBatchTemplate(config: WordTemplateAppConfig): XLSX.WorkBook {
  return AppPackager.generateBatchTemplateWorkbook(XLSX, config);
}

function loadGeneratedRuntime(config: WordTemplateAppConfig) {
  const runtimeCode = GeneratedAppScript.generate(config, "template.docx");

  const elements = new Map<string, any>();
  const getElement = (id: string) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        style: {},
        textContent: "",
        innerHTML: "",
        className: "",
        disabled: false,
        value: "",
        title: "",
        attributes: new Map<string, string>(),
        addEventListener() {},
        setAttribute(name: string, value: string) {
          this.attributes.set(name, value);
        },
        getAttribute(name: string) {
          return this.attributes.get(name);
        }
      });
    }
    return elements.get(id);
  };
  const document = {
    title: "批量应用",
    getElementById: getElement,
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return { href: "", download: "", click() {} };
    }
  };
  const runtimeContext = createBrowserContext({
    XLSX,
    document,
    alert() {},
    confirm() {
      return false;
    },
    fetch: async () => ({ ok: false })
  });

  vm.runInContext(
    `${runtimeCode}
globalThis.__runtime = {
  buildBatchRow,
  formatDate,
  formatLocalDateStamp,
  renderBatchPreview,
  sanitizeFileName,
  setBatchRows(rows) { batchRows = rows; },
  setBatchPreviewExpanded(value) { batchPreviewExpanded = value; },
  getElement: document.getElementById
};`,
    runtimeContext
  );

  return runtimeContext.__runtime as any;
}

describe("word template filler generated batch app", () => {
  it("generates batch import controls without a template download entry", () => {
    const html = loadGeneratedHtml({
      fields: [
        { name: "name", label: "姓名", type: "text", required: true },
        { name: "date", label: "日期", type: "date", format: "YYYY年MM月DD日" },
        { name: "level", label: "等级", type: "radio", options: "优秀,合格" }
      ],
      loopFields: {}
    });

    expect(html).toContain("批量生成");
    expect(html).toContain("随包提供的批量导入模板");
    expect(html).not.toContain("下载批量导入模板");
    expect(html).not.toContain("downloadBatchTemplateBtn");
    expect(html).not.toContain("downloadBatchTemplate");
    expect(html).toContain("const BATCH_TITLE_COLUMN = '文件标题'");
    expect(html).toContain('id="batchPreviewToggle"');
    expect(html).toContain("downloadBlob(blob, document.title + '_批量导出_' + timestamp + '.zip')");
    expect(html).toContain('<script src="libs/xlsx.full.min.js">');
    expect(html).toContain('<script src="libs/jszip.min.js">');
  });

  it("builds the packaged batch Excel template with file title as the first column", () => {
    const workbook = buildPackagedBatchTemplate({
      fields: [
        { name: "name", label: "姓名", type: "text", required: true },
        { name: "date", label: "日期", type: "date", format: "YYYY年MM月DD日" },
        { name: "level", label: "等级", type: "radio", options: "优秀,合格" }
      ],
      loopFields: {}
    });
    const dataSheet = workbook.Sheets["批量数据"];
    const helpSheet = workbook.Sheets["填写说明"];

    expect(workbook.SheetNames).toEqual(["批量数据", "填写说明"]);
    expect(dataSheet.A1.v).toBe("文件标题");
    expect(dataSheet.B1.v).toBe("姓名");
    expect(dataSheet.C1.v).toBe("日期");
    expect(dataSheet.D1.v).toBe("等级");
    expect(helpSheet.A8.v).toBe("Excel列名");
    expect(helpSheet.B9.v).toBe("name");
  });

  it("shows that batch import does not support loop fields in the first version", () => {
    const html = loadGeneratedHtml({
      fields: [
        { name: "name", label: "姓名", type: "text" },
        { name: "items", label: "明细", type: "loop" }
      ],
      loopFields: {
        items: [{ name: "itemName", label: "项目", type: "text" }]
      }
    });

    expect(html).toContain("当前配置包含列表/循环字段，批量导入第一版暂不支持");
    expect(html).toContain("const HAS_LOOP_FIELDS = CONFIG.fields.some(field => field.type === 'loop')");
  });

  it("documents xlsx and jszip dependencies in the packaged app instructions", () => {
    const instructions = loadInstructions();

    expect(instructions).toContain("批量生成");
    expect(instructions).toContain("测试应用_批量导入模板.xlsx");
    expect(instructions).toContain("批量导入模板由生成器随压缩包同步导出");
    expect(instructions).toContain("xlsx.full.min.js");
    expect(instructions).toContain("jszip.min.js");
  });

  it("maps one imported Excel row into render data and validates option fields", () => {
    const runtime = loadGeneratedRuntime({
      fields: [
        { name: "name", label: "姓名", type: "text", required: true },
        { name: "date", label: "日期", type: "date", format: "YYYY年MM月DD日" },
        { name: "passed", label: "是否通过", type: "boolean" },
        { name: "level", label: "等级", type: "radio", options: "优秀,合格" },
        { name: "tags", label: "标签", type: "checkbox", options: "A,B,C" }
      ],
      loopFields: {}
    });

    const row = runtime.buildBatchRow({
      文件标题: "张/三:报告",
      姓名: "张三",
      日期: "2026/6/23",
      是否通过: "是",
      等级: "优秀",
      标签: "A、C"
    }, 2, 0);

    expect(row.title).toBe("张_三_报告");
    expect(row.fileName).toBe("张_三_报告.docx");
    expect(row.errors).toEqual([]);
    expect(row.data.name).toBe("张三");
    expect(row.data.date).toBe("2026年06月23日");
    expect(row.data.passedPass).toBe("☑");
    expect(row.data.passedFail).toBe("□");
    expect(row.data.level_优秀).toBe("☑");
    expect(row.data.level_合格).toBe("□");
    expect(row.data.tags).toBe("A、C");
    expect(row.data.tags_A).toBe("☑");
    expect(row.data.tags_B).toBe("□");
    expect(row.data.tags_C).toBe("☑");

    const invalid = runtime.buildBatchRow({
      文件标题: "",
      姓名: "",
      等级: "不合格",
      标签: "A、D"
    }, 3, 1);

    expect(invalid.title).toBe("批量应用_002");
    expect(invalid.errors).toContain("姓名不能为空");
    expect(invalid.errors).toContain("等级选项无效：不合格");
    expect(invalid.errors).toContain("标签包含无效选项：D");
  });

  it("collapses batch preview by default and expands to show all rows", () => {
    const runtime = loadGeneratedRuntime({
      fields: [
        { name: "name", label: "姓名", type: "text" }
      ],
      loopFields: {}
    });
    const rows = Array.from({ length: 39 }, (_, index) => ({
      rowNumber: index + 2,
      title: `标题${index + 1}`,
      fileName: `标题${index + 1}.docx`,
      data: {},
      errors: []
    }));

    runtime.setBatchRows(rows);
    runtime.renderBatchPreview();

    const preview = runtime.getElement("batchPreview");
    const toggle = runtime.getElement("batchPreviewToggle");
    expect(preview.innerHTML.match(/<tbody><tr>/g)).toHaveLength(1);
    expect(preview.innerHTML.match(/<\/tr><tr>/g)).toHaveLength(19);
    expect(toggle.style.display).toBe("inline-flex");
    expect(toggle.textContent).toBe("展开");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    runtime.setBatchPreviewExpanded(true);
    runtime.renderBatchPreview();

    expect(preview.innerHTML.match(/<tbody><tr>/g)).toHaveLength(1);
    expect(preview.innerHTML.match(/<\/tr><tr>/g)).toHaveLength(38);
    expect(toggle.textContent).toBe("收起");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("normalizes Excel date-like values without leaking JavaScript Date text", () => {
    const runtime = loadGeneratedRuntime({
      fields: [
        { name: "name", label: "姓名", type: "text" },
        { name: "plainDate", label: "文本日期", type: "text" },
        { name: "date", label: "日期", type: "date", format: "YYYY年MM月DD日" },
        { name: "serialDate", label: "序列日期", type: "date", format: "YYYY-MM-DD" },
        { name: "compactDate", label: "紧凑日期", type: "date", format: "YYYY-MM-DD" }
      ],
      loopFields: {}
    });

    const row = runtime.buildBatchRow({
      文件标题: "日期测试",
      姓名: "张三",
      文本日期: new Date(2026, 4, 11),
      日期: new Date(2026, 4, 11),
      序列日期: 46153,
      紧凑日期: "20260511"
    }, 2, 0);

    expect(row.errors).toEqual([]);
    expect(row.data.plainDate).toBe("2026-05-11");
    expect(row.data.plainDate).not.toContain("GMT");
    expect(row.data.date).toBe("2026年05月11日");
    expect(row.data.serialDate).toBe("2026-05-11");
    expect(row.data.compactDate).toBe("2026-05-11");
  });

  it("does not coerce plain numeric text fields into dates", () => {
    const runtime = loadGeneratedRuntime({
      fields: [
        { name: "code", label: "编号", type: "text" }
      ],
      loopFields: {}
    });

    const row = runtime.buildBatchRow({
      文件标题: "编号测试",
      编号: 46153
    }, 2, 0);

    expect(row.errors).toEqual([]);
    expect(row.data.code).toBe("46153");
  });

  it("uses local calendar dates for generated file name stamps", () => {
    const runtime = loadGeneratedRuntime({
      fields: [],
      loopFields: {}
    });

    expect(runtime.formatLocalDateStamp(new Date(2026, 4, 11, 1, 30, 0, 0))).toBe("2026-05-11");
  });

  it("rounds SheetJS date objects near midnight back to the intended Excel day", () => {
    const runtime = loadGeneratedRuntime({
      fields: [
        { name: "date", label: "日期", type: "date", format: "YYYY-MM-DD" }
      ],
      loopFields: {}
    });

    const row = runtime.buildBatchRow({
      文件标题: "日期边界",
      日期: new Date(2026, 4, 10, 23, 59, 59, 999)
    }, 2, 0);

    expect(row.errors).toEqual([]);
    expect(row.data.date).toBe("2026-05-11");
  });

  it("keeps ambiguous short slash dates invalid for batch date fields", () => {
    const runtime = loadGeneratedRuntime({
      fields: [
        { name: "date", label: "日期", type: "date", format: "YYYY-MM-DD" }
      ],
      loopFields: {}
    });

    const row = runtime.buildBatchRow({
      文件标题: "歧义日期",
      日期: "5/11/26"
    }, 2, 0);

    expect(row.data.date).toBe("");
    expect(row.errors).toContain("日期不是有效日期");
  });
});
