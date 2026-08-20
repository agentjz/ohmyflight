function text(value) {
    return String(value ?? "");
}

function inlineCode(value) {
    return `\`${text(value).replaceAll("`", "\\`")}\``;
}

function tableCell(value) {
    return text(value)
        .replaceAll("|", "\\|")
        .replace(/\r?\n/g, "<br>");
}

function markdownTable(headers, rows) {
    const lines = [
        `| ${headers.map(tableCell).join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`
    ];
    if (rows.length) {
        rows.forEach((row) => lines.push(`| ${row.map(tableCell).join(" | ")} |`));
    } else {
        lines.push(`| ${["无", ...headers.slice(1).map(() => "")].join(" | ")} |`);
    }
    return lines.join("\n");
}

function requirement(parameter) {
    if (parameter.fixed || parameter.derived || parameter.derivedFrom || parameter.auto) return "自动生成";
    if (parameter.required) return "必填";
    if (parameter.requiredWhen) {
        const [name, value] = Object.entries(parameter.requiredWhen)[0] || [];
        return `${name}=${value} 时必填`;
    }
    return "可选";
}

function parameterSource(parameter) {
    if (parameter.auto) return `执行时生成 ${parameter.auto}`;
    if (parameter.derivedFrom) return `根据 ${parameter.derivedFrom.parameter}.${parameter.derivedFrom.field} 生成`;
    if (parameter.derived) return "由前置请求或业务输入计算";
    if (parameter.default !== undefined) return text(parameter.default);
    return "";
}

function parameterRules(parameter) {
    const rules = [];
    if (parameter.fixed) rules.push("固定字段");
    if (parameter.repeatable) rules.push("重复同名字段");
    if (parameter.includeWhenEmpty) rules.push("空值也发送");
    if (parameter.maxlength) rules.push(`最多 ${parameter.maxlength} 字符`);
    if (parameter.optionSource) rules.push(`动态选项：${parameter.optionSource}`);
    if (parameter.options?.length) {
        rules.push(`选项：${parameter.options.map((item) => `${item.value}=${item.label}`).join("；")}`);
    }
    return rules.join("；");
}

function canonicalModule(module) {
    const { catalogSource: _catalogSource, ...source } = module;
    return source;
}

function sourceName(module) {
    const configured = text(module.catalogSource).split("/").pop();
    return configured || `${module.id}.json`;
}

function moduleIndex(modules) {
    return {
        schemaVersion: 1,
        modules: modules.map((module) => ({
            id: module.id,
            name: module.name,
            description: module.description,
            source: `./${sourceName(module)}`
        }))
    };
}

function uniqueCookies(modules) {
    const cookies = new Map();
    modules.forEach((module) => {
        (module.cookies || []).forEach((cookie) => {
            if (!cookies.has(cookie.name)) cookies.set(cookie.name, cookie);
        });
    });
    return [...cookies.values()];
}

function appendEndpoint(lines, module, endpoint, index) {
    const headers = [...(module.commonHeaders || []), ...(endpoint.headers || [])];
    lines.push(
        `### ${index + 1}. ${endpoint.name}`,
        "",
        `- 技术 ID：${inlineCode(`${module.id}.${endpoint.id}`)}`,
        `- 风险：${endpoint.risk === "write" ? "写操作" : "只读"}`,
        `- 方法：${inlineCode(endpoint.method)}`,
        `- 完整 URL：${inlineCode(module.baseUrl + endpoint.path)}`,
        `- 响应格式：${text(endpoint.response?.format)}`,
        "",
        text(endpoint.summary),
        "",
        "#### 请求 Headers",
        "",
        markdownTable(["名称", "值", "说明"], headers.map((header) => [
            inlineCode(header.name),
            inlineCode(header.value),
            header.description || ""
        ])),
        "",
        "#### 请求参数",
        "",
        markdownTable(["名称", "位置", "类型", "要求", "默认或来源", "约束与选项", "说明"], (endpoint.parameters || []).map((parameter) => [
            inlineCode(parameter.name),
            parameter.in === "query" ? "Query" : "Form",
            inlineCode(parameter.type || "text"),
            requirement(parameter),
            parameterSource(parameter),
            parameterRules(parameter),
            parameter.description || ""
        ])),
        "",
        "#### 响应状态",
        "",
        markdownTable(["HTTP 状态", "业务含义"], (endpoint.response?.statuses || []).map((status) => [
            inlineCode(status.code),
            status.description || ""
        ])),
        "",
        "#### 响应字段",
        "",
        markdownTable(["名称", "类型", "说明"], (endpoint.response?.fields || []).map((field) => [
            inlineCode(field.name),
            inlineCode(field.type),
            field.description || ""
        ])),
        "",
        "#### 脱敏响应示例",
        "",
        "```json",
        text(endpoint.response?.example || "{}"),
        "```",
        ""
    );
}

function appendInternalRequests(lines, module) {
    lines.push("### 内部请求链路", "");
    (module.internalRequests || []).forEach((request, index) => {
        lines.push(
            `#### ${index + 1}. ${request.name}`,
            "",
            `- 技术 ID：${inlineCode(request.id)}`,
            `- 方法：${inlineCode(request.method)}`,
            `- 路径：${inlineCode(request.path)}`,
            `- 完整 URL：${inlineCode(module.baseUrl + request.path)}`,
            `- 用途：${text(request.purpose)}`,
            "- 请求 Headers："
        );
        const headers = [...(module.commonHeaders || []), ...(request.headers || [])];
        if (headers.length) {
            headers.forEach((header) => lines.push(`  - ${inlineCode(header.name)}: ${inlineCode(header.value)}${header.description ? ` - ${text(header.description)}` : ""}`));
        } else {
            lines.push("  - 无");
        }
        lines.push("- 请求参数：");
        if (request.parameters?.length) {
            request.parameters.forEach((parameter) => lines.push(`  - ${inlineCode(parameter)}`));
        } else {
            lines.push("  - 无");
        }
        lines.push(`- 响应契约：${text(request.response)}`, "");
    });
}

function appendModule(lines, module, index) {
    lines.push(
        `## ${index + 1}. ${module.name}`,
        "",
        text(module.description),
        "",
        `- 模块 ID：${inlineCode(module.id)}`,
        `- 系统 ID：${inlineCode(module.systemId)}`,
        `- 基础地址：${inlineCode(module.baseUrl)}`,
        `- 门户导航：${inlineCode(module.navigationUrl)}`,
        "",
        "### 业务接口",
        ""
    );
    (module.endpoints || []).forEach((endpoint, endpointIndex) => appendEndpoint(lines, module, endpoint, endpointIndex));
    appendInternalRequests(lines, module);
    lines.push("### 技术说明", "");
    (module.technicalNotes || []).forEach((note) => lines.push(`- ${text(note)}`));
    lines.push("");
}

export function buildApiDocsMarkdown(modules) {
    const catalogModules = Array.isArray(modules) ? modules : [];
    const cookies = uniqueCookies(catalogModules);
    const lines = [
        "---",
        "documentType: watchdog-api-catalog",
        "schemaVersion: 1",
        "system: flight-portal",
        "---",
        "",
        "# watchdog API 文档",
        "",
        "> 本文件由 API 文档目录生成。正文供人连续阅读，附录保留供语言模型或程序读取的同源 JSON。",
        "",
        "## 使用边界",
        "",
        "- 本文件记录 HTTP 请求事实，不替代批量业务工作台。",
        "- 写操作仍需调用者明确确认目标、日期和动作。",
        "- 导出不包含运行时 Cookie、真实响应、人员数据或本地会话状态。",
        "",
        "## 认证与会话",
        "",
        markdownTable(["Cookie", "要求", "技术事实"], cookies.map((cookie) => [
            inlineCode(cookie.name),
            cookie.required ? "必填" : "可选",
            cookie.description || ""
        ])),
        "",
        "Cookie 值由调用者从当前已登录会话提供；本文档只记录字段名称和认证事实。",
        ""
    ];

    catalogModules.forEach((module, index) => appendModule(lines, module, index));

    lines.push(
        "## 附录：机器可读原始目录",
        "",
        "以下 JSON 与页面和本地执行器使用的目录同源，用于无损保留字段、条件和内部请求契约。",
        "",
        "### 模块索引",
        "",
        "````json",
        JSON.stringify(moduleIndex(catalogModules), null, 2),
        "````",
        ""
    );
    catalogModules.forEach((module) => {
        lines.push(
            `### ${module.name} 原始目录`,
            "",
            "````json",
            JSON.stringify(canonicalModule(module), null, 2),
            "````",
            ""
        );
    });
    return `${lines.join("\n").trim()}\n`;
}

export function downloadMarkdown(markdown, filename = "watchdog-api-docs.md") {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
