// 生成应用运行时：模板文件加载

export const GeneratedAppRuntimeTemplate = {
    generate: () => `
// 页面加载时尝试加载模板
async function loadTemplate() {
    try {
        const resp = await fetch(TEMPLATE_FILE);
        if (!resp.ok) throw new Error('模板文件不存在');
        const blob = await resp.blob();
        templateData = await blob.arrayBuffer();
        console.log('模板加载成功');
    } catch (e) {
        console.warn('自动加载模板失败，需要手动上传:', e.message);
        document.getElementById('uploadHint').style.display = 'block';
    }
}
loadTemplate();

// 手动上传模板
document.getElementById('templateFile').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (file) {
        templateData = await file.arrayBuffer();
        document.getElementById('uploadedFileName').textContent = '已选择: ' + file.name;
    }
});
`
};
