// 生成应用运行时：批量 Excel 导入和预览

export const GeneratedAppRuntimeBatch = {
    generate: () => `
function getBatchHeader(field) {
    return field.label || field.name;
}

function getBatchValue(row, field) {
    const candidates = [field.label, field.name, '{' + field.name + '}'].filter(Boolean);
    for (const key of candidates) {
        if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    }
    return '';
}

function normalizeBoolean(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) return { empty: true, valid: true, isYes: false };
    if (['是', 'true', '1', 'yes', 'y'].includes(text)) return { empty: false, valid: true, isYes: true };
    if (['否', 'false', '0', 'no', 'n'].includes(text)) return { empty: false, valid: true, isYes: false };
    return { empty: false, valid: false, isYes: false };
}

function splitCheckboxValue(value) {
    return normalizeText(value).split(/[，,、;；\\n\\r]+/).map(item => item.trim()).filter(Boolean);
}

function buildBatchRow(rawRow, rowNumber, index) {
    const errors = [];
    const data = {};
    const fallbackTitle = document.title + '_' + String(index + 1).padStart(3, '0');
    const title = sanitizeFileName(rawRow[BATCH_TITLE_COLUMN]) || fallbackTitle;

    BATCH_FIELDS.forEach(field => {
        const rawValue = getBatchValue(rawRow, field);
        const value = normalizeText(rawValue) || normalizeText(field.defaultValue);
        const isEmpty = !value;

        if (field.required && isEmpty) {
            errors.push(getBatchHeader(field) + '不能为空');
        }

        switch (field.type) {
            case 'text':
            case 'textarea':
                data[field.name] = formatPlainValue(rawValue) || normalizeText(field.defaultValue);
                break;
            case 'date': {
                const formatted = value ? formatDate(rawValue || field.defaultValue, field.format) : '';
                if (value && !formatted) errors.push(getBatchHeader(field) + '不是有效日期');
                data[field.name] = formatted;
                break;
            }
            case 'boolean': {
                const boolValue = normalizeBoolean(value);
                if (!boolValue.valid) errors.push(getBatchHeader(field) + '只能填写 是/否');
                data[field.name] = boolValue.isYes ? '是' : '否';
                data[field.name + 'Pass'] = boolValue.isYes ? '☑' : '□';
                data[field.name + 'Fail'] = boolValue.isYes ? '□' : '☑';
                break;
            }
            case 'radio': {
                const options = getFieldOptions(field);
                if (value && options.length && !options.includes(value)) {
                    errors.push(getBatchHeader(field) + '选项无效：' + value);
                }
                data[field.name] = value;
                options.forEach(opt => {
                    data[field.name + '_' + opt] = value === opt ? '☑' : '□';
                });
                break;
            }
            case 'checkbox': {
                const options = getFieldOptions(field);
                const values = splitCheckboxValue(value);
                const invalidValues = values.filter(item => options.length && !options.includes(item));
                if (invalidValues.length) {
                    errors.push(getBatchHeader(field) + '包含无效选项：' + invalidValues.join('、'));
                }
                data[field.name] = values.join('、');
                options.forEach(opt => {
                    data[field.name + '_' + opt] = values.includes(opt) ? '☑' : '□';
                });
                break;
            }
        }
    });

    return {
        rowNumber,
        title,
        fileName: title + '.docx',
        data,
        errors
    };
}

function buildBatchRows(workbook) {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Excel没有工作表');

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: '',
        raw: true
    }).filter(row => Object.values(row).some(value => normalizeText(value)));

    return rows.map((row, index) => buildBatchRow(row, index + 2, index));
}

function setBatchPreviewToggle(button, visibleRows) {
    if (!button) return;
    if (batchRows.length <= BATCH_PREVIEW_COLLAPSED_LIMIT) {
        button.style.display = 'none';
        button.setAttribute('aria-expanded', 'false');
        return;
    }
    button.style.display = 'inline-flex';
    button.textContent = batchPreviewExpanded ? '收起' : '展开';
    button.setAttribute('aria-expanded', batchPreviewExpanded ? 'true' : 'false');
    button.title = '当前显示 ' + visibleRows + ' / ' + batchRows.length + ' 行';
}

function renderBatchPreview() {
    const preview = document.getElementById('batchPreview');
    const status = document.getElementById('batchStatus');
    const exportBtn = document.getElementById('exportBatchBtn');
    const previewToggle = document.getElementById('batchPreviewToggle');
    const errorRows = batchRows.filter(row => row.errors.length);

    if (!batchRows.length) {
        preview.style.display = 'none';
        if (previewToggle) previewToggle.style.display = 'none';
        status.className = 'batch-status';
        status.textContent = '没有读取到可导出的数据行。';
        exportBtn.disabled = true;
        return;
    }

    status.className = 'batch-status ' + (errorRows.length ? 'error' : 'success');
    status.textContent = '共读取 ' + batchRows.length + ' 行，' + (batchRows.length - errorRows.length) + ' 行可导出，' + errorRows.length + ' 行需修正。';
    exportBtn.disabled = errorRows.length > 0;

    const visibleRows = batchPreviewExpanded ? batchRows : batchRows.slice(0, BATCH_PREVIEW_COLLAPSED_LIMIT);
    setBatchPreviewToggle(previewToggle, visibleRows.length);

    const rowsHtml = visibleRows.map(row => {
        const state = row.errors.length ? '需修正' : '可导出';
        const detail = row.errors.length ? row.errors.join('；') : row.fileName;
        const stateClass = row.errors.length ? 'error' : 'success';
        return '<tr><td>第' + row.rowNumber + '行</td><td>' + escapeHtml(row.title) + '</td><td class="' + stateClass + '">' + state + '</td><td>' + escapeHtml(detail) + '</td></tr>';
    }).join('');

    preview.innerHTML = '<thead><tr><th>来源行</th><th>文件标题</th><th>状态</th><th>说明</th></tr></thead><tbody>' + rowsHtml + '</tbody>';
    preview.style.display = 'table';
}

function handleBatchFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const result = event.target?.result;
            if (!(result instanceof ArrayBuffer)) throw new Error('文件读取失败');
            const workbook = XLSX.read(new Uint8Array(result), { type: 'array', cellDates: true });
            batchRows = buildBatchRows(workbook);
            batchPreviewExpanded = false;
            renderBatchPreview();
        } catch (error) {
            batchRows = [];
            batchPreviewExpanded = false;
            const status = document.getElementById('batchStatus');
            document.getElementById('batchPreview').style.display = 'none';
            document.getElementById('batchPreviewToggle').style.display = 'none';
            document.getElementById('exportBatchBtn').disabled = true;
            status.className = 'batch-status error';
            status.textContent = '导入失败：' + error.message;
        }
    };
    reader.readAsArrayBuffer(file);
}
`
};
