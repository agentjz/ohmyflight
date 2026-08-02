// 生成应用运行时：Word 渲染和文件下载

export const GeneratedAppRuntimeExport = {
    generate: () => `
function renderWord(data, outputType) {
    const zip = new PizZip(templateData);
    const doc = new window.docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
    });

    doc.render(data);

    return doc.getZip().generate({
        type: outputType,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

async function exportBatchWords() {
    if (!templateData) {
        alert('请先导入模板文件！');
        return;
    }
    if (!batchRows.length || batchRows.some(row => row.errors.length)) {
        alert('请先导入无错误的批量Excel。');
        return;
    }

    const outputZip = new JSZip();
    const usedNames = new Set();
    const manifest = [['来源行', '文件名', '状态', '说明']];

    batchRows.forEach(row => {
        let safeBaseName = sanitizeFileName(row.title) || sanitizeFileName(document.title);
        let fileName = safeBaseName + '.docx';
        let suffix = 2;
        while (usedNames.has(fileName)) {
            fileName = safeBaseName + '_' + suffix + '.docx';
            suffix += 1;
        }
        usedNames.add(fileName);

        try {
            outputZip.file(fileName, renderWord(row.data, 'arraybuffer'));
            manifest.push([row.rowNumber, fileName, '成功', '']);
        } catch (error) {
            manifest.push([row.rowNumber, fileName, '失败', error.message]);
        }
    });

    const manifestText = '\\uFEFF' + manifest.map(row => row.map(cell => '"' + String(cell ?? '').replace(/"/g, '""') + '"').join(',')).join('\\r\\n');
    outputZip.file('导出结果清单.csv', manifestText);

    const blob = await outputZip.generateAsync({ type: 'blob' });
    const timestamp = formatLocalDateStamp();
    downloadBlob(blob, document.title + '_批量导出_' + timestamp + '.zip');
}
`
};
