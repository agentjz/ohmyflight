import type { ToolItem } from "./models";

export const tools: ToolItem[] = [
    { name: "菜鸟教程", desc: "哈哈。好活。置顶。", entry: "beginner-tutorial", status: "done", category: "light", homepageState: "beta", homepageVisibility: "hidden" },
    { name: "培训皇帝", desc: "查个人资质、排培训、核对覆盖率、年度负载均衡、更新有效期", entry: "training-workbench", status: "done", category: "heavy", homepageVisibility: "hidden" },
    { name: "换季学习", desc: "换季学习负载均衡", entry: "seasonal-learning", status: "done", category: "heavy", homepageVisibility: "hidden" },
    { name: "审计之王", desc: "从检查项检索手册证据，整理审计依据和 PDF 页面", entry: "audit-king", status: "done", category: "heavy", homepageVisibility: "hidden" },
    { name: "校对之王", desc: "比对同一本手册新旧版，增删改情况。", entry: "proof-king", status: "done", category: "heavy", homepageState: "beta" },
    { name: "姓名匹配员工号", desc: "识别姓名并匹配员工号", entry: "crew-match-name-id", status: "done", category: "light", homepageVisibility: "hidden" },
    { name: "酒店皇帝", desc: "对比酒店账单与入住登记表", entry: "hotel-bill-check", status: "done", category: "light" },
    { name: "重点人员标注", desc: "在审班表中标注重点人员", entry: "focus-crew", status: "done", category: "light" },
    { name: "航线班次统计", desc: "按排班表统计每人各航线班次", entry: "crew-flight-stats", status: "done", category: "light" },
    { name: "Word 模板填充器", desc: "按配置生成表单并批量填充 Word 模板", entry: "word-template-filler", status: "done", category: "light" },
    { name: "PDF 工具", desc: "提取、合并、转图片和图片转 PDF", entry: "pdf-tool", status: "done", category: "light", homepageVisibility: "hidden" },
    { name: "PDF 加水印", desc: "在 PDF 每页统一位置添加图片水印", entry: "pdf-stamp", status: "done", category: "light" },
    { name: "图片工具", desc: "转换、压缩、裁剪、缩放和 Base64 互转", entry: "image-tool", status: "done", category: "light", homepageVisibility: "hidden" },
    { name: "文本拼接助手", desc: "清除换行与常见分隔符，按指定字符重新拼接", entry: "text-joiner", status: "done", category: "light" },
    { name: "人员结构统计", desc: "按报告口径统计人员结构并生成报告", entry: "personnel-structure-stats", status: "done", category: "light", homepageVisibility: "hidden" },
    { name: "运行资质比对", desc: "按员工号核对人员信息与飞行门户运行资质名册", entry: "qualification-roster-compare", status: "done", category: "light" },
    { name: "锁班乞丐", desc: "乞丐版，用playwright自动化模拟锁班。", entry: "lock-entry-helper", status: "done", category: "automation", homepageState: "cooling" },
    { name: "飞行经历查询（乞丐版）", desc: "playwright批量查询飞行时间+起落数、飞行经历+起落数、左座经历+起落数或全部数据", entry: "flight-stats-helper", status: "done", category: "automation", homepageState: "cooling" },
    { name: "珠海皇帝", desc: "核对场次表与账单表姓名人次", entry: "session-bill-check", status: "done", category: "light", homepageState: "cooling" },
    { name: "自动点 OA 助手", desc: "自动处理可确认的 OA 已阅待办", entry: "oa-read-helper", status: "done", category: "automation", homepageState: "cooling" }
];
