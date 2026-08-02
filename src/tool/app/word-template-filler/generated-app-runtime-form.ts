// 生成应用运行时：表单数据收集和通用工具

export const GeneratedAppRuntimeForm = {
    generate: () => `
// 收集表单数据
function collectFormData() {
    const data = {};
    
    CONFIG.fields.forEach(field => {
        switch (field.type) {
            case 'text':
            case 'textarea':
                data[field.name] = document.getElementById(field.name)?.value || '';
                break;
            case 'date':
                const dateVal = document.getElementById(field.name)?.value || '';
                data[field.name] = formatDate(dateVal, field.format);
                break;
            case 'boolean':
                const boolVal = document.querySelector('input[name="' + field.name + '"]:checked')?.value;
                const isYes = boolVal === '是';
                data[field.name] = isYes ? '是' : '否';
                data[field.name + 'Pass'] = isYes ? '☑' : '□';
                data[field.name + 'Fail'] = isYes ? '□' : '☑';
                break;
            case 'radio':
                const radioVal = document.querySelector('input[name="' + field.name + '"]:checked')?.value || '';
                data[field.name] = radioVal;
                (field.options || '').split(',').forEach(opt => {
                    opt = opt.trim();
                    if (opt) data[field.name + '_' + opt] = (radioVal === opt) ? '☑' : '□';
                });
                break;
            case 'checkbox':
                const checked = document.querySelectorAll('input[name="' + field.name + '"]:checked');
                const checkedVals = Array.from(checked).map(el => el.value);
                data[field.name] = checkedVals.join('、');
                (field.options || '').split(',').forEach(opt => {
                    opt = opt.trim();
                    if (opt) data[field.name + '_' + opt] = checkedVals.includes(opt) ? '☑' : '□';
                });
                break;
            case 'loop':
                const subFields = CONFIG.loopFields[field.name] || [];
                const tbody = document.querySelector('#table_' + field.name + ' tbody');
                const rows = tbody?.querySelectorAll('tr') || [];
                data[field.name] = Array.from(rows).map(row => {
                    const rowData = {};
                    subFields.forEach((sf, i) => {
                        const input = row.querySelectorAll('input, textarea, select')[i];
                        let val = input?.value || '';
                        if (sf.type === 'date') val = formatDate(val, sf.format);
                        rowData[sf.name] = val;
                    });
                    return rowData;
                });
                break;
        }
    });
    
    return data;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function getFieldOptions(field) {
    return (field.options || '').split(',').map(item => item.trim()).filter(Boolean);
}

function sanitizeFileName(value) {
    return normalizeText(value).replace(/[\\\\/:*?"<>|]/g, '_').replace(/\\s+/g, ' ').trim();
}
`
};
