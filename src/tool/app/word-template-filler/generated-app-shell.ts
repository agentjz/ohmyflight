// 生成应用的 HTML 骨架

import { GeneratedAppStyles } from "./generated-app-styles";

type GeneratedAppShellInput = {
    appName: string;
    templateFileName: string;
    formHtml: string;
    jsCode: string;
};

export const GeneratedAppShell = {
    generate: ({appName, templateFileName, formHtml, jsCode}: GeneratedAppShellInput) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${appName}</title>
    <style>
${GeneratedAppStyles.generate()}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${appName}</h1>
            <p>填写完成后可导出为Word文档</p>
        </div>

        <div class="panel">
            <div id="uploadHint" class="upload-hint" style="display:none;">
                模板文件未找到，请<label>点击上传模板<input type="file" id="templateFile" accept=".docx" style="display:none;"></label>（${templateFileName}）<span id="uploadedFileName" class="file-name"></span>
            </div>
${formHtml}
            <div class="button-group">
                <button class="btn btn-primary" id="exportBtn">导出Word文档</button>
                <button class="btn" id="clearBtn">清空表单</button>
            </div>
            <div class="batch-section" id="batchSection">
                <h2>批量生成</h2>
                <p>使用压缩包里随包提供的批量导入模板，把每份文档的信息填到 Excel。第一列“文件标题”用于控制导出的 Word 文件名，留空时自动使用应用名称和序号。</p>
                <div id="batchUnsupported" class="batch-status error" style="display:none;">当前配置包含列表/循环字段，批量导入第一版暂不支持，请使用上方单份填写。</div>
                <div id="batchSupported">
                    <div class="batch-actions">
                        <label class="btn">导入Excel<input type="file" id="batchFile" accept=".xlsx,.xls"></label>
                        <button class="btn btn-primary" id="exportBatchBtn" type="button" disabled>批量导出Word ZIP</button>
                    </div>
                    <div id="batchStatus" class="batch-status">尚未导入批量 Excel。</div>
                    <button class="batch-preview-toggle" id="batchPreviewToggle" type="button" style="display:none;" aria-expanded="false">展开</button>
                    <table class="batch-preview" id="batchPreview" style="display:none;"></table>
                </div>
            </div>
        </div>
    </div>

    <script src="libs/xlsx.full.min.js"><\/script>
    <script src="libs/jszip.min.js"><\/script>
    <script src="libs/pizzip.min.js"><\/script>
    <script src="libs/docxtemplater.min.js"><\/script>
    <script>
${jsCode}
    <\/script>
</body>
</html>`
};
