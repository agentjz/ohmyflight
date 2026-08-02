// HTML页面生成器
// 根据配置组合生成完整、可离线运行的 HTML 文件

import { GeneratedAppScript } from "./generated-app-script";
import { GeneratedAppShell } from "./generated-app-shell";
import type { WordTemplateAppConfig, WordTemplateFieldConfig } from "./models";

export const HtmlGenerator = {
    generate: (config: WordTemplateAppConfig, appName: string, templateFileName: string): string => {
        const formHtml = HtmlGenerator.generateFormHtml(config);
        const jsCode = GeneratedAppScript.generate(config, templateFileName);
        return GeneratedAppShell.generate({appName, templateFileName, formHtml, jsCode});
    },

    generateFormHtml: (config: WordTemplateAppConfig): string => {
        let html = '';

        config.fields.forEach(field => {
            switch (field.type) {
                case 'text':
                    html += HtmlGenerator.textField(field);
                    break;
                case 'textarea':
                    html += HtmlGenerator.textareaField(field);
                    break;
                case 'date':
                    html += HtmlGenerator.dateField(field);
                    break;
                case 'boolean':
                    html += HtmlGenerator.booleanField(field);
                    break;
                case 'radio':
                    html += HtmlGenerator.radioField(field);
                    break;
                case 'checkbox':
                    html += HtmlGenerator.checkboxField(field);
                    break;
                case 'loop': {
                    const subFields = config.loopFields[field.name] || [];
                    html += HtmlGenerator.loopField(field, subFields);
                    break;
                }
            }
        });

        return html;
    },

    textField: (field: WordTemplateFieldConfig): string => `
            <div class="form-group">
                <label>${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
                <input type="text" id="${field.name}" placeholder="${field.placeholder || ''}" value="${field.defaultValue || ''}">
            </div>
`,

    textareaField: (field: WordTemplateFieldConfig): string => `
            <div class="form-group">
                <label>${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
                <textarea id="${field.name}" placeholder="${field.placeholder || ''}" rows="${field.rows || 3}">${field.defaultValue || ''}</textarea>
            </div>
`,

    dateField: (field: WordTemplateFieldConfig): string => `
            <div class="form-group">
                <label>${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
                <input type="date" id="${field.name}">
            </div>
`,

    booleanField: (field: WordTemplateFieldConfig): string => {
        const isYesDefault = field.defaultValue === '是'
            || field.defaultValue === 'true'
            || (field.defaultValue as unknown) === true;
        return `
            <div class="form-group">
                <label>${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
                <div class="radio-group">
                    <label><input type="radio" name="${field.name}" value="是" ${isYesDefault ? 'checked' : ''}> 是</label>
                    <label><input type="radio" name="${field.name}" value="否" ${!isYesDefault ? 'checked' : ''}> 否</label>
                </div>
            </div>
`;
    },

    radioField: (field: WordTemplateFieldConfig): string => {
        const options = (field.options || '').split(',').map(o => o.trim()).filter(o => o);
        const optionsHtml = options.map((opt, i) =>
            `<label><input type="radio" name="${field.name}" value="${opt}" ${(field.defaultValue === opt) || (i === 0 && !field.defaultValue) ? 'checked' : ''}> ${opt}</label>`
        ).join('\n                    ');

        return `
            <div class="form-group">
                <label>${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
                <div class="radio-group">
                    ${optionsHtml}
                </div>
            </div>
`;
    },

    checkboxField: (field: WordTemplateFieldConfig): string => {
        const options = (field.options || '').split(',').map(o => o.trim()).filter(o => o);
        const defaults = (field.defaultValue || '').split(',').map(o => o.trim());
        const optionsHtml = options.map(opt =>
            `<label><input type="checkbox" name="${field.name}" value="${opt}" ${defaults.includes(opt) ? 'checked' : ''}> ${opt}</label>`
        ).join('\n                    ');

        return `
            <div class="form-group">
                <label>${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
                <div class="checkbox-group">
                    ${optionsHtml}
                </div>
            </div>
`;
    },

    loopField: (field: WordTemplateFieldConfig, subFields: WordTemplateFieldConfig[]): string => {
        const headerHtml = subFields.map(sf => `<th>${sf.label}</th>`).join('');

        return `
            <div class="form-group">
                <label>${field.label}${field.required ? '<span class="required">*</span>' : ''}</label>
                <table class="loop-table" id="table_${field.name}">
                    <thead><tr>${headerHtml}<th style="width:60px">操作</th></tr></thead>
                    <tbody></tbody>
                </table>
                <button type="button" class="btn btn-sm" onclick="addLoopRow('${field.name}')">+ 添加行</button>
            </div>
`;
    }
};

