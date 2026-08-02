// 生成应用运行时：循环列表表单

export const GeneratedAppRuntimeLoop = {
    generate: () => `
// 循环列表管理
function addLoopRow(fieldName) {
    const subFields = CONFIG.loopFields[fieldName] || [];
    const tbody = document.querySelector('#table_' + fieldName + ' tbody');
    const tr = document.createElement('tr');
    
    subFields.forEach(sf => {
        const td = document.createElement('td');
        if (sf.type === 'textarea') {
            td.innerHTML = '<textarea style="min-height:60px"></textarea>';
        } else if (sf.type === 'radio') {
            const opts = (sf.options || '').split(',').map(o => o.trim()).filter(o => o);
            td.innerHTML = '<select>' + opts.map((o,i) => '<option' + (i===0?' selected':'') + '>' + o + '</option>').join('') + '</select>';
        } else {
            td.innerHTML = '<input type="' + (sf.type === 'date' ? 'date' : 'text') + '">';
        }
        tr.appendChild(td);
    });
    
    const actionTd = document.createElement('td');
    actionTd.innerHTML = '<button type="button" class="btn btn-sm btn-danger" onclick="this.closest(\\'tr\\').remove()">删除</button>';
    tr.appendChild(actionTd);
    
    tbody.appendChild(tr);
}

// 初始化循环列表
CONFIG.fields.filter(f => f.type === 'loop').forEach(field => {
    addLoopRow(field.name);
});
`
};
