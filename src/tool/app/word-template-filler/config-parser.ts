// Excel配置文件解析器
// 解析用户上传的Excel配置文件，提取字段定义

import type {
    WordTemplateAppConfig,
    WordTemplateFieldConfig,
    WordTemplateXlsxApi
} from "./models";

type WordTemplateConfigRow = Record<string, unknown>;

export const ConfigParser = {
    // 解析Excel文件
    parse: async (file: File, xlsx: WordTemplateXlsxApi): Promise<WordTemplateAppConfig> => {
        return new Promise<WordTemplateAppConfig>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const result = e.target?.result;
                    if (!(result instanceof ArrayBuffer)) {
                        reject(new Error('文件读取失败'));
                        return;
                    }

                    const data = new Uint8Array(result);
                    const workbook = xlsx.read(data, { type: 'array' });
                    
                    const config = ConfigParser.parseWorkbook(workbook, xlsx);
                    resolve(config);
                } catch (error) {
                    reject(new Error('Excel解析失败: ' + (error instanceof Error ? error.message : String(error))));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsArrayBuffer(file);
        });
    },

    // 解析工作簿
    parseWorkbook: (
        workbook: import("xlsx-js-style").WorkBook,
        xlsx: WordTemplateXlsxApi
    ): WordTemplateAppConfig => {
        const config: WordTemplateAppConfig = {
            fields: [],
            loopFields: {}
        };

        // 解析主配置sheet（第一个sheet或名为"字段配置"的sheet）
        const mainSheetName = workbook.SheetNames.find(name => name === '字段配置') || workbook.SheetNames[0];
        const mainSheet = workbook.Sheets[mainSheetName];
        const mainData = xlsx.utils.sheet_to_json<WordTemplateConfigRow>(mainSheet);

        mainData.forEach(row => {
            const field = ConfigParser.parseFieldRow(row);
            if (field) {
                config.fields.push(field);

                // 如果是loop类型，查找对应的子字段sheet
                if (field.type === 'loop') {
                    const subSheetName = field.subSheet || field.name;
                    if (workbook.SheetNames.includes(subSheetName)) {
                        const subSheet = workbook.Sheets[subSheetName];
                        const subData = xlsx.utils.sheet_to_json<WordTemplateConfigRow>(subSheet);
                        config.loopFields[field.name] = subData
                            .map(r => ConfigParser.parseFieldRow(r))
                            .filter((f): f is WordTemplateFieldConfig => Boolean(f));
                    }
                }
            }
        });

        return config;
    },

    // 解析单行字段配置
    parseFieldRow: (row: WordTemplateConfigRow): WordTemplateFieldConfig | null => {
        // 支持中英文列名
        const name = row['字段名'] || row['name'] || row['字段'] || '';
        const label = row['显示名称'] || row['label'] || row['名称'] || row['标签'] || name;
        const type = ConfigParser.normalizeType(row['类型'] || row['type'] || 'text');
        const options = row['选项'] || row['options'] || '';
        const defaultValue = row['默认值'] || row['default'] || '';
        const required = row['必填'] || row['required'] || '';
        const placeholder = row['提示'] || row['placeholder'] || '';
        const format = row['格式'] || row['format'] || '';
        const subSheet = row['子表'] || row['subSheet'] || '';
        const rows = row['行数'] || row['rows'] || 3;

        if (!name) return null;

        return {
            name: String(name).trim(),
            label: String(label).trim(),
            type,
            options: options.toString().trim(),
            defaultValue: defaultValue.toString().trim(),
            required: required === '是' || required === 'true' || required === true,
            placeholder: placeholder.toString().trim(),
            format: format.toString().trim(),
            subSheet: subSheet.toString().trim(),
            rows: Number.parseInt(String(rows), 10) || 3
        };
    },

    // 标准化类型名称
    normalizeType: (type: unknown): string => {
        const typeMap: Record<string, string> = {
            '文本': 'text',
            '单行文本': 'text',
            '多行文本': 'textarea',
            '文本域': 'textarea',
            '日期': 'date',
            '是否': 'boolean',
            '布尔': 'boolean',
            '单选': 'radio',
            '多选': 'checkbox',
            '列表': 'loop',
            '循环': 'loop',
            '表格': 'loop'
        };
        const normalized = String(type).trim().toLowerCase();
        const rawType = String(type).trim();
        return typeMap[rawType] || typeMap[normalized] || normalized || 'text';
    }
};
