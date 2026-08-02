import { TrainingToolConfig } from "./config";
import { TrainingToolRuleEngine } from "./rule-engine";
import { TrainingToolUtils } from "./utils";
import type { TrainingProjectRule } from "./models";

const Config = TrainingToolConfig;
  const Utils = TrainingToolUtils;
  const RuleEngine = TrainingToolRuleEngine;

  const elements = {
    projectBody: requireElement("projectBody"),
    excelGuideBody: requireElement("excelGuideBody"),
    caseSections: requireElement("caseSections")
  };

  function requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`培训规则页缺少 ${id}。`);
    return element;
  }

  interface RuleExample {
    projectName: string;
    title: string;
    trainingDate: string;
    oldExpiry: string;
    resultType: string;
    newExpiry: string;
    reason: string;
  }

  function getRuleMap(): Map<string, TrainingProjectRule> {
    return new Map(Config.PROJECT_RULES.map((rule) => [rule.canonical, rule]));
  }

  function formatRuleDuration(rule: TrainingProjectRule): string {
    return `${rule.validityValue}${Utils.normalizeText(rule.validityUnit)}`;
  }

  function formatWindowText(rule: TrainingProjectRule): string {
    const windowInfo = RuleEngine.getWindowInfo(rule, Utils.makeDate(2027, 6, 15));
    if (!windowInfo.hasWindow) return "无窗口";
    return windowInfo.tag || "窗口";
  }

  function normalizeResultType(rule: TrainingProjectRule, trainingDate: Date, oldExpiry: Date | null): string {
    if (!oldExpiry) return "首次/无旧值";
    const judgement = RuleEngine.classifyUpdateJudgement(rule, trainingDate, oldExpiry);
    if (judgement === "最新日期重算") return "无窗口";
    if (judgement === "提前窗口外") return "提前/窗口外";
    return judgement;
  }

  function buildExample(ruleName: string, title: string, trainingDateText: string, oldExpiryText: string): RuleExample {
    const rule = getRuleMap().get(ruleName)!;
    const trainingDate = Utils.parseDate(trainingDateText)!;
    const oldExpiry = Utils.parseDate(oldExpiryText);
    const computed = RuleEngine.computeExpiry(rule, trainingDate, oldExpiry);
    return {
      projectName: ruleName,
      title,
      trainingDate: trainingDateText,
      oldExpiry: oldExpiryText || "",
      resultType: normalizeResultType(rule, trainingDate, oldExpiry),
      newExpiry: Utils.formatDate(computed.newExpiry),
      reason: computed.reason
    };
  }

  function buildSections(): Array<{ title: string; rows: RuleExample[] }> {
    return [
      {
        title: "基准月类：应急训练",
        rows: [
          buildExample("应急训练", "首次培训", "2000-01-01", ""),
          buildExample("应急训练", "窗口起点复训", "2001-12-01", "2002-02-28"),
          buildExample("应急训练", "窗口中间复训", "2002-01-15", "2002-02-28"),
          buildExample("应急训练", "窗口终点复训", "2002-02-28", "2002-02-28"),
          buildExample("应急训练", "提前太多复训", "2001-11-30", "2002-02-28"),
          buildExample("应急训练", "窗口后补训", "2002-03-01", "2002-02-28")
        ]
      },
      {
        title: "3个月窗口类：危险品",
        rows: [
          buildExample("危险品", "首次培训", "2000-01-01", ""),
          buildExample("危险品", "窗口起点复训", "2027-03-15", "2027-06-15"),
          buildExample("危险品", "窗口终点复训", "2027-06-14", "2027-06-15"),
          buildExample("危险品", "失效日当天补训", "2027-06-15", "2027-06-15"),
          buildExample("危险品", "提前太多", "2027-03-14", "2027-06-15")
        ]
      },
      {
        title: "3个月窗口类：英语能力 / 汉语能力",
        rows: [
          buildExample("英语能力", "窗口起点续考", "2027-03-15", "2027-06-15"),
          buildExample("英语能力", "失效日当天续考", "2027-06-15", "2027-06-15"),
          buildExample("英语能力", "提前太多", "2027-03-14", "2027-06-15"),
          buildExample("汉语能力", "窗口内续考", "2027-05-20", "2027-06-15"),
          buildExample("汉语能力", "失效日当天续考", "2027-06-15", "2027-06-15"),
          buildExample("汉语能力", "超期后续考", "2027-06-16", "2027-06-15")
        ]
      },
      {
        title: "最新日期类：航空安保 / TSA / 疲劳管理 / 飞行作风",
        rows: [
          buildExample("航空安保", "首次培训", "2000-01-01", ""),
          buildExample("航空安保", "有效期内复训", "2001-12-20", "2002-01-31"),
          buildExample("TSA", "首次培训", "2026-05-06", ""),
          buildExample("TSA", "有效期内复训", "2026-05-06", "2026-05-31"),
          buildExample("疲劳管理", "提前复训", "2000-06-15", "2002-01-31"),
          buildExample("疲劳管理", "到期当天复训", "2002-01-31", "2002-01-31"),
          buildExample("飞行作风", "过期后补训", "2002-03-01", "2002-01-31"),
          buildExample("飞行作风", "再次复训", "2003-05-10", "2004-03-31")
        ]
      }
    ];
  }

  function badgeClass(resultType: string): string {
    if (resultType === "命中窗口") return "warn";
    if (resultType === "超期") return "danger";
    return "info";
  }

  function renderProjectTable(): void {
    elements.projectBody.innerHTML = Config.PROJECT_RULES.map((rule) => `
      <tr>
        <td>${Utils.escapeHtml(rule.canonical)}</td>
        <td>${Utils.escapeHtml(rule.aliases.join(" / "))}</td>
        <td>${Utils.escapeHtml(rule.ruleType)}</td>
        <td>${Utils.escapeHtml(formatRuleDuration(rule))}</td>
        <td>${Utils.escapeHtml(formatWindowText(rule))}</td>
        <td>${Utils.escapeHtml(rule.rounding)}</td>
      </tr>
    `).join("");
  }

  function buildExcelGuideRows(): Array<{ scene: string; rule: string }> {
    return [
      {
        scene: "人员信息表有效期",
        rule: "每个有效期项目维护一列，到期日以人员信息表为准。"
      },
      {
        scene: "项目 sheet 有效期列",
        rule: "用于人工查看；排班判断和有效期更新以人员信息表有效期列和项目培训日期为准。"
      },
      {
        scene: "培训信息是否录入",
        rule: "人工录入状态字段，不参与排班覆盖判断。"
      },
      {
        scene: "机器看",
        rule: "写“Y”时参与有效期更新；备注包含“取消”时按异常跳过。"
      },
      {
        scene: "备注取消",
        rule: "备注包含“取消”时，这条排班记录按取消处理。"
      },
      {
        scene: "航空安保",
        rule: "做了航空安保，就在“航空安保”sheet 记录。"
      },
      {
        scene: "TSA",
        rule: "做了 TSA，就在“TSA”sheet 记录。"
      },
      {
        scene: "同一天做航空安保和 TSA",
        rule: "“航空安保”sheet 记一条，“TSA”sheet 也记一条。"
      }
    ];
  }

  function renderExcelGuide(): void {
    if (!elements.excelGuideBody) return;
    elements.excelGuideBody.innerHTML = buildExcelGuideRows().map((row) => `
      <tr>
        <td>${Utils.escapeHtml(row.scene)}</td>
        <td>${Utils.escapeHtml(row.rule)}</td>
      </tr>
    `).join("");
  }

  function renderCaseSections(): void {
    elements.caseSections.innerHTML = buildSections().map((section) => `
      <article class="section" style="margin-top: 16px;">
        <div class="section-head">
          <div>
            <h3 class="section-title" style="margin-top:0;">${Utils.escapeHtml(section.title)}</h3>
          </div>
        </div>
        <div class="table-shell">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th>项目</th>
                <th>场景</th>
                <th>旧有效期</th>
                <th>培训开始日期</th>
                <th>判断</th>
                <th>新有效期</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              ${section.rows.map((row) => `
                <tr>
                  <td>${Utils.escapeHtml(row.projectName)}</td>
                  <td>${Utils.escapeHtml(row.title)}</td>
                  <td>${Utils.escapeHtml(row.oldExpiry || "无")}</td>
                  <td>${Utils.escapeHtml(row.trainingDate)}</td>
                  <td><span class="badge ${badgeClass(row.resultType)}">${Utils.escapeHtml(row.resultType)}</span></td>
                  <td>${Utils.escapeHtml(row.newExpiry)}</td>
                  <td>${Utils.escapeHtml(row.reason)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `).join("");
  }

  renderProjectTable();
  renderExcelGuide();
  renderCaseSections();
