// 应用打包器
// 将生成的HTML、Word模板、依赖库打包成zip（完全离线可用）

import type {
    WordTemplateAppConfig,
    WordTemplateDependencies,
    WordTemplateFieldConfig,
    WordTemplateXlsxApi
} from "./models";

type BatchPackageOptions = {
    batchTemplateFileName: string;
    hasLoopFields: boolean;
};

export const AppPackager = {
    BATCH_TITLE_COLUMN: '文件标题',

    // 加载库文件内容
    loadLibFile: async (path: string): Promise<string> => {
        const resp = await fetch(path);
        if (!resp.ok) throw new Error(`无法加载 ${path}`);
        return await resp.text();
    },

    // 打包应用
    package: async (
        dependencies: WordTemplateDependencies,
        config: WordTemplateAppConfig,
        appName: string,
        htmlContent: string,
        templateFile: File
    ): Promise<void> => {
        const zip = new dependencies.JSZip();
        
        // 生成文件名（去除特殊字符）
        const safeName = appName.replace(/[\\/:*?"<>|]/g, '_');
        
        // 1. 添加HTML文件
        zip.file(`${safeName}.html`, htmlContent);
        
        // 2. 添加Word模板
        const templateData = await templateFile.arrayBuffer();
        zip.file(templateFile.name, templateData);
        
        // 3. 添加批量导入模板
        const hasLoopFields = AppPackager.hasLoopFields(config);
        const batchTemplateFileName = `${safeName}_批量导入模板.xlsx`;
        if (!hasLoopFields) {
            zip.file(batchTemplateFileName, AppPackager.generateBatchTemplateArrayBuffer(dependencies.XLSX, config));
        }

        // 4. 添加依赖库文件
        const libsFolder = zip.folder('libs');
        try {
            const pizzipContent = await AppPackager.loadLibFile('../../../libs/pizzip.min.js');
            libsFolder.file('pizzip.min.js', pizzipContent);
            
            const docxContent = await AppPackager.loadLibFile('../../../libs/docxtemplater.min.js');
            libsFolder.file('docxtemplater.min.js', docxContent);

            const xlsxContent = await AppPackager.loadLibFile('../../../libs/xlsx.full.min.js');
            libsFolder.file('xlsx.full.min.js', xlsxContent);

            const jszipContent = await AppPackager.loadLibFile('../../../libs/jszip.min.js');
            libsFolder.file('jszip.min.js', jszipContent);
        } catch (e) {
            console.error('加载库文件失败:', e);
            alert('打包失败：无法加载依赖库文件');
            return;
        }
        
        // 5. 生成说明文档
        const instructionText = AppPackager.generateInstructions(appName, safeName, templateFile.name, {
            batchTemplateFileName,
            hasLoopFields
        });
        zip.file('使用说明.txt', instructionText);
        
        // 6. 生成配置备份（方便以后修改）
        const configBackup = AppPackager.generateConfigBackup(config);
        zip.file('配置备份.json', configBackup);
        
        // 生成zip文件
        const blob = await zip.generateAsync({ type: 'blob' });
        
        // 下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    hasLoopFields: (config: WordTemplateAppConfig): boolean => {
        return config.fields.some(field => field.type === 'loop');
    },

    getBatchFields: (config: WordTemplateAppConfig): WordTemplateFieldConfig[] => {
        return config.fields.filter(field => field.type !== 'loop');
    },

    getBatchHeader: (field: WordTemplateFieldConfig): string => {
        return field.label || field.name;
    },

    generateBatchTemplateWorkbook: (
        xlsx: WordTemplateXlsxApi,
        config: WordTemplateAppConfig
    ): import("xlsx-js-style").WorkBook => {
        const batchFields = AppPackager.getBatchFields(config);
        const headers = [AppPackager.BATCH_TITLE_COLUMN, ...batchFields.map(AppPackager.getBatchHeader)];
        const workbook = xlsx.utils.book_new();
        const dataSheet = xlsx.utils.aoa_to_sheet([headers]);
        dataSheet['!cols'] = headers.map((header, index) => ({ wch: index === 0 ? 24 : Math.max(14, String(header).length + 4) }));
        xlsx.utils.book_append_sheet(workbook, dataSheet, '批量数据');

        const helpRows = [
            ['说明', ''],
            ['一行数据会生成一份Word文档。', ''],
            ['文件标题', '用于导出的Word文件名，可留空。'],
            ['多选字段', '多个选项用中文顿号、逗号、分号或换行分隔。'],
            ['是否字段', '填写 是/否。'],
            ['列表/循环字段', '第一版批量导入暂不支持。'],
            [],
            ['Excel列名', '字段名', '类型', '必填', '选项', '日期格式'],
            ...batchFields.map(field => [
                AppPackager.getBatchHeader(field),
                field.name,
                field.type,
                field.required ? '是' : '',
                field.options || '',
                field.format || ''
            ])
        ];
        const helpSheet = xlsx.utils.aoa_to_sheet(helpRows);
        helpSheet['!cols'] = [{ wch: 28 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 36 }, { wch: 18 }];
        xlsx.utils.book_append_sheet(workbook, helpSheet, '填写说明');

        return workbook;
    },

    generateBatchTemplateArrayBuffer: (
        xlsx: WordTemplateXlsxApi,
        config: WordTemplateAppConfig
    ): ArrayBuffer => {
        return xlsx.write(AppPackager.generateBatchTemplateWorkbook(xlsx, config), {
            bookType: 'xlsx',
            type: 'array'
        }) as ArrayBuffer;
    },

    // 生成说明文档
    generateInstructions: (
        appName: string,
        safeName: string,
        templateFileName: string,
        batchOptions: BatchPackageOptions = {
            batchTemplateFileName: `${safeName}_批量导入模板.xlsx`,
            hasLoopFields: false
        }
    ): string => {
        const batchTemplateLine = batchOptions.hasLoopFields
            ? '- 当前配置包含列表/循环字段，第一版不随包提供批量导入模板'
            : `- ${batchOptions.batchTemplateFileName}    批量导入Excel模板`;
        const batchUsage = batchOptions.hasLoopFields
            ? '当前配置包含列表/循环字段，第一版批量导入暂不支持，请使用单份填写。'
            : `1. 打开随压缩包提供的 ${batchOptions.batchTemplateFileName}
2. 在 Excel 中按行填写信息，第一列"文件标题"用于控制每份 Word 的文件名
3. 打开 ${safeName}.html
4. 在"批量生成"区域导入填写好的 Excel，确认预览无错误后点击"批量导出Word ZIP"`;
        const batchTemplateTree = batchOptions.hasLoopFields ? '' : `├── ${batchOptions.batchTemplateFileName}
`;

        return `${appName} - 使用说明
========================================

【文件清单】
- ${safeName}.html    填写页面
- ${templateFileName}    Word模板
${batchTemplateLine}
- 使用说明.txt    本文件
- 配置备份.json    配置数据备份

【使用方法】
1. 将 ${safeName}.html 和 ${templateFileName} 放在同一文件夹
2. 用浏览器打开 ${safeName}.html
3. 填写表单内容
4. 点击"导出Word文档"

【批量生成】
${batchUsage}

【注意事项】
- HTML、Word模板、libs文件夹必须放在同一目录
- 批量导入模板由生成器随压缩包同步导出，不在填写页面内另行生成
- 如果提示模板未找到，点击上传模板文件即可
- 推荐使用Chrome或Edge浏览器
- 完全离线可用，无需联网

【目录结构】
解压后保持以下结构：
├── ${safeName}.html
├── ${templateFileName}
${batchTemplateTree}└── libs/
    ├── pizzip.min.js
    ├── docxtemplater.min.js
    ├── xlsx.full.min.js
    └── jszip.min.js

生成时间：${new Date().toLocaleString('zh-CN')}
`;
    },
    
    // 生成配置备份
    generateConfigBackup: (config: WordTemplateAppConfig): string => {
        return JSON.stringify(config, null, 2);
    }
};
