import type { SiteAnnouncement, ToolItem } from "./models";

export const tools: ToolItem[] = [
    { name: "菜鸟教程", desc: "新兵蛋子，立正！", entry: "beginner-tutorial", status: "done", category: "light", homepageState: "beta" },
    { name: "培训皇帝", desc: "查个人资质、排培训、核覆盖、看年度压力并更新有效期", entry: "training-workbench", status: "done", category: "heavy" },
    { name: "换季学习", desc: "检查换季名单，均衡岗位和美线带队并移动导出实际安排", entry: "seasonal-learning", status: "done", category: "heavy" },
    { name: "审计之王", desc: "从检查项检索手册证据，整理审计依据和 PDF 页面", entry: "audit-king", status: "done", category: "heavy" },
    { name: "校对之王", desc: "比对同一本手册新旧版，复核新增、删除和修改", entry: "proof-king", status: "done", category: "heavy", homepageState: "beta" },
    { name: "姓名匹配员工号", desc: "识别姓名并匹配员工号", entry: "crew-match-name-id", status: "done", category: "light" },
    { name: "锁班皇帝", desc: "批量录入锁班信息的 Python 工具", entry: "lock-entry-helper", status: "done", category: "automation" },
    { name: "飞行经历/左座经历起落数按天统计", desc: "批量查询飞行经历、左座经历和起落数", entry: "flight-stats-helper", status: "done", category: "automation" },
    { name: "技术等级运行资格查询助手", desc: "按 Excel 员工号逐人查询 IEB 技术等级和运行资格", entry: "qualification-query-helper", status: "done", category: "automation" },
    { name: "珠海皇帝", desc: "核对场次表与账单表姓名人次", entry: "session-bill-check", status: "done", category: "light", homepageState: "cooling" },
    { name: "酒店皇帝", desc: "对比酒店账单与入住登记表", entry: "hotel-bill-check", status: "done", category: "light" },
    { name: "重点人员标注", desc: "在审班表中标注重点人员", entry: "focus-crew", status: "done", category: "light" },
    { name: "航线班次统计", desc: "按排班表统计每人各航线班次", entry: "crew-flight-stats", status: "done", category: "light" },
    { name: "自动点 OA 助手", desc: "自动处理可确认的 OA 已阅待办", entry: "oa-read-helper", status: "done", category: "automation", homepageState: "cooling" },
    { name: "Word 模板填充器", desc: "按配置生成表单并批量填充 Word 模板", entry: "word-template-filler", status: "done", category: "light" },
    { name: "PDF 工具", desc: "提取、合并、转图片和图片转 PDF", entry: "pdf-tool", status: "done", category: "light" },
    { name: "PDF 加水印", desc: "在 PDF 每页统一位置添加图片水印", entry: "pdf-stamp", status: "done", category: "light" },
    { name: "图片工具", desc: "转换、压缩、裁剪、缩放和 Base64 互转", entry: "image-tool", status: "done", category: "light" },
    { name: "文本拼接助手", desc: "清除换行与常见分隔符，按指定字符重新拼接", entry: "text-joiner", status: "done", category: "light" },
    { name: "人员结构统计", desc: "按报告口径统计人员结构并生成报告", entry: "personnel-structure-stats", status: "done", category: "light" }
];

export const announcement: SiteAnnouncement = {
    message: "🎉🎉🎉都变成了温和的野兽派！",
    href: "../sponsor/index.html"
};
