import type { TrainingProjectRule } from "./models";

const PROJECT_RULES: TrainingProjectRule[] = [
    {
      canonical: "应急训练",
      aliases: ["应急训练", "EP-飞行人员应急复训"],
      ruleType: "基准月",
      validityValue: 24,
      validityUnit: "日历月",
      baseMonthFlex: 1,
      rounding: "月底",
      enabled: true
    },
    {
      canonical: "危险品",
      aliases: ["危险品", "DGET-危险品培训"],
      ruleType: "3个月窗口（截止到前一日）",
      validityValue: 2,
      validityUnit: "年",
      baseMonthFlex: 0,
      rounding: "当日",
      enabled: true
    },
    {
      canonical: "航空安保",
      aliases: ["航空安保"],
      ruleType: "最新日期",
      validityValue: 24,
      validityUnit: "日历月",
      baseMonthFlex: 0,
      rounding: "月底",
      enabled: true
    },
    {
      canonical: "TSA",
      aliases: ["TSA"],
      ruleType: "最新日期",
      validityValue: 12,
      validityUnit: "日历月",
      baseMonthFlex: 0,
      rounding: "月底",
      enabled: true
    },
    {
      canonical: "疲劳管理",
      aliases: ["疲劳管理"],
      ruleType: "最新日期",
      validityValue: 24,
      validityUnit: "日历月",
      baseMonthFlex: 0,
      rounding: "月底",
      enabled: true
    },
    {
      canonical: "飞行作风",
      aliases: ["飞行作风"],
      ruleType: "最新日期",
      validityValue: 24,
      validityUnit: "日历月",
      baseMonthFlex: 0,
      rounding: "月底",
      enabled: true
    },
    {
      canonical: "英语能力",
      aliases: ["英语能力", "LG_STUDY-英语语言学习/考试"],
      ruleType: "3个月窗口",
      validityValue: 3,
      validityUnit: "年",
      baseMonthFlex: 0,
      rounding: "当日",
      enabled: true
    },
    {
      canonical: "汉语能力",
      aliases: ["汉语能力", "LG_STUDY-汉语语言学习/考试"],
      ruleType: "3个月窗口",
      validityValue: 6,
      validityUnit: "年",
      baseMonthFlex: 0,
      rounding: "当日",
      enabled: true
    }
  ];

  const PROJECT_ALIAS_LOOKUP = new Map<string, string>();
  PROJECT_RULES.forEach((rule) => {
    [rule.canonical, ...rule.aliases].forEach((alias) => {
      PROJECT_ALIAS_LOOKUP.set(alias, rule.canonical);
    });
  });
  export const TrainingToolConfig = {
    PEOPLE_SHEET_NAME: "人员信息表",
    REPORT_SHEET_NAME: "更新报告",
    GENERATED_SHEET_SUFFIX: "预排（生成）",
    LONG_DATE_FORMAT: 'yyyy"年"m"月"d"日";@',
    DISPLAY_DATE_FORMAT: "yyyy-mm-dd",
    IGNORED_SHEET_NAMES: new Set(["CRM"]),
    REQUIRED_PEOPLE_HEADERS: ["员工号", "姓名"],
    REQUIRED_PROJECT_HEADERS: ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期"],
    DEFAULT_SCHEDULE_HEADERS: [
      "员工号",
      "姓名",
      "项目名称",
      "培训开始日期",
      "培训结束日期",
      "培训信息是否录入",
      "机器看",
      "训练类型",
      "考试类型",
      "锁班情况",
      "教员",
      "是否参加",
      "备注",
      "有效期"
    ],
    DYNAMIC_SCHEDULE_HEADERS: new Set([
      "序号",
      "员工号",
      "姓名",
      "项目名称",
      "培训开始日期",
      "培训结束日期",
      "培训信息是否录入",
      "有效期"
    ]),
    TRUE_LIKE_VALUES: ["是", "Y", "y", "YES", "Yes", "TRUE", "true", "1", "4"],
    NULL_LIKE_VALUES: ["", "/", "N/A", "NA", "None", "不适用", "无", "null", "NULL"],
    PROJECT_RULES,
    PROJECT_ALIAS_LOOKUP
  };
