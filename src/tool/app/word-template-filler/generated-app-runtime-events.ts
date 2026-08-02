// 生成应用运行时：页面事件绑定

export const GeneratedAppRuntimeEvents = {
    generate: () => `
// 导出Word
document.getElementById('exportBtn').addEventListener('click', async function() {
    if (!templateData) {
        alert('请先导入模板文件！');
        return;
    }
    
    const data = collectFormData();
    console.log('导出数据:', data);
    
    try {
        const blob = renderWord(data, 'blob');
        const timestamp = formatLocalDateStamp();
        downloadBlob(blob, document.title + '_' + timestamp + '.docx');
    } catch (error) {
        console.error(error);
        alert('导出失败：' + error.message);
    }
});

// 清空表单
document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('确定要清空所有填写内容吗？')) {
        document.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(el => {
            el.value = '';
        });
        // 重置每组radio的第一个为选中状态
        const radioGroups = {};
        document.querySelectorAll('input[type="radio"]').forEach(el => {
            const name = el.name;
            if (!radioGroups[name]) {
                radioGroups[name] = true;
                el.checked = true;
            } else {
                el.checked = false;
            }
        });
        document.querySelectorAll('input[type="checkbox"]').forEach(el => {
            el.checked = false;
        });
        CONFIG.fields.filter(f => f.type === 'loop').forEach(field => {
            const tbody = document.querySelector('#table_' + field.name + ' tbody');
            if (tbody) {
                tbody.innerHTML = '';
                addLoopRow(field.name);
            }
        });
    }
});

if (HAS_LOOP_FIELDS) {
    document.getElementById('batchUnsupported').style.display = 'block';
    document.getElementById('batchSupported').style.display = 'none';
} else {
    document.getElementById('batchFile').addEventListener('change', function(e) {
        handleBatchFile(e.target.files[0]);
    });
    document.getElementById('batchPreviewToggle').addEventListener('click', function() {
        batchPreviewExpanded = !batchPreviewExpanded;
        renderBatchPreview();
    });
    document.getElementById('exportBatchBtn').addEventListener('click', exportBatchWords);
}

// 设置日期字段默认值为今天
CONFIG.fields.filter(f => f.type === 'date').forEach(field => {
    const el = document.getElementById(field.name);
    if (el && !el.value) el.valueAsDate = new Date();
});
`
};
