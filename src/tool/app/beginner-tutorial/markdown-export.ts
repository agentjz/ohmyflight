import type {
    BeginnerTutorialData,
    TutorialModule,
    TutorialRecord,
    TutorialSourceRef,
    TutorialStep
} from "./types";

function text(value: unknown): string {
    return String(value ?? "");
}

function inlineCode(value: unknown): string {
    return `\`${text(value).replace(/`/g, "\\`")}\``;
}

function appendSources(
    lines: string[],
    sources: TutorialSourceRef[] | undefined,
    headingLevel = 4
): void {
    lines.push(`${"#".repeat(headingLevel)} 来源`, "");
    if (!sources?.length) {
        lines.push("- 当前条目未配置独立来源。", "");
        return;
    }
    for (const source of sources) {
        lines.push(
            `- ${inlineCode(source.id)} 《${source.manual}》${source.version}，${source.chapter}，${source.section}`
        );
    }
    lines.push("");
}

function appendStep(lines: string[], step: TutorialStep, index: number): void {
    lines.push(
        `### ${index + 1}. ${step.title}`,
        "",
        `- 步骤 ID：${inlineCode(step.id)}`,
        "",
        step.summary,
        ""
    );
    appendSources(lines, step.sources);
}

function appendRecordFields(
    lines: string[],
    record: TutorialRecord,
    headingLevel: number
): void {
    const heading = "#".repeat(headingLevel);
    lines.push(
        `${heading} 当前动作`,
        "",
        record.action,
        "",
        `${heading} 保持、失效与恢复`,
        "",
        record.lifecycle,
        ""
    );

    if (record.sections?.length) {
        lines.push(`${heading} 结构化细节`, "");
        for (const section of record.sections) {
            lines.push(
                headingLevel < 6 ? `${heading}# ${section.title}` : `**${section.title}**`,
                ""
            );
            for (const item of section.items) lines.push(`- ${item}`);
            lines.push("");
        }
    }
}

export function beginnerTutorialRecordAnchor(moduleId: string, recordId: string): string {
    return `record-${moduleId}-${recordId}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function appendRecord(lines: string[], record: TutorialRecord, moduleId: string, index: number): void {
    lines.push(
        `<a id="${beginnerTutorialRecordAnchor(moduleId, record.id)}"></a>`,
        `### ${index + 1}. ${record.title}`,
        "",
        `- 记录 ID：${inlineCode(record.id)}`,
        `- 核对状态：${inlineCode(record.status)}`,
        `- 适用对象：${record.audience}`,
        `- 类别：${record.category}`,
        ...(record.track ? [`- 路径：${record.track}`] : []),
        "",
        record.summary,
        ""
    );
    appendRecordFields(lines, record, 4);

    if (record.recoveryRecords?.length) {
        lines.push("#### 恢复规则", "");
        for (const recoveryRule of record.recoveryRecords) {
            lines.push(
                `- [${recoveryRule.title}](#${beginnerTutorialRecordAnchor(recoveryRule.moduleId, recoveryRule.targetId)})：${recoveryRule.summary}`
            );
        }
        lines.push("");
    }

    appendSources(lines, record.sources);
}

function appendModule(lines: string[], module: TutorialModule, index: number): void {
    lines.push(
        `## ${index + 1}. ${module.title}`,
        "",
        `- 模块 ID：${inlineCode(module.id)}`,
        `- 内容类型：${inlineCode(module.kind)}`,
        ...(module.progression ? [`- 成长路径：${module.progression}`] : []),
        "",
        module.summary,
        ""
    );

    if (module.body) {
        lines.push("### 模块正文", "", module.body.trim(), "");
    }
    module.steps?.forEach((step, stepIndex) => appendStep(lines, step, stepIndex));
    module.records?.forEach((record, recordIndex) => appendRecord(lines, record, module.id, recordIndex));
    if (module.sources?.length) appendSources(lines, module.sources);
}

export function buildBeginnerTutorialMarkdown(data: BeginnerTutorialData): string {
    const lines = [
        "---",
        "documentType: watchdog-beginner-tutorial",
        `schemaVersion: ${data.schemaVersion}`,
        `title: ${JSON.stringify(data.title)}`,
        "---",
        "",
        `# ${data.title}`,
        "",
        "> 本文件由菜鸟教程当前同源数据生成。正文供人连续阅读，附录保留供语言模型或程序复核的完整 JSON。",
        "",
        data.description,
        "",
        "## 使用边界",
        "",
        "- 内容仅来自页面标注版本的《飞行人员训练大纲》和《飞行技术管理手册》。",
        "- 航段、飞行次数、起落、PF/PM、昼间/夜间、训练、检查、签注、聘任和资质发布按原条目分别表达，不能互相替代。",
        "- 标记为部分确认的条目存在手册边界，办理具体业务时仍须核对当期批准文件和个人记录。",
        "- 同一条恢复规则只在其权威模块出现一次；其他条目只保留直接适用的恢复规则链接。",
        "- 导出不包含搜索词、展开状态或其他临时页面状态。",
        "",
        "## 来源索引",
        ""
    ];

    for (const source of data.sourceScope) {
        lines.push(
            `- ${inlineCode(source.id)} 《${source.manual}》${source.version}，${source.chapter}，${source.section}`
        );
    }
    lines.push("");

    data.modules.forEach((module, index) => appendModule(lines, module, index));

    lines.push(
        "## 附录：机器可读原始教程",
        "",
        "以下 JSON 与页面加载的数据完全同源，用于无损保留模块、记录、结构化分段、恢复规则链接和来源。",
        "",
        "````json",
        JSON.stringify(data, null, 2),
        "````",
        ""
    );

    return `${lines.join("\n").trim()}\n`;
}

export function downloadBeginnerTutorialMarkdown(
    markdown: string,
    filename = "南货航飞行员成长与资质.md"
): void {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
