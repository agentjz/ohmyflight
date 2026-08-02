import type * as XlsxRuntime from "xlsx-js-style";

import { createFocusCrewLogic } from "./logic";
import type { FocusCrewElements, FocusCrewJsonRow, FocusCrewWorkbook, FocusSheetInfo } from "./models";
import { displayStats, renderFocusSheets, renderPreview, renderSelectors } from "./view";

const XLSX = window.XLSX as unknown as typeof XlsxRuntime;

let scheduleWorkbook: FocusCrewWorkbook | null = null;
let focusWorkbook: FocusCrewWorkbook | null = null;
let scheduleData: FocusCrewJsonRow[] = [];
let focusSheets: FocusSheetInfo[] = [];
let scheduleColumns: string[] = [];
let resultWorkbook: FocusCrewWorkbook | null = null;

const elements: FocusCrewElements = {
    scheduleFile: requireElement('scheduleFile', HTMLInputElement),
    focusFile: requireElement('focusFile', HTMLInputElement),
    highlightBtn: requireElement('highlightBtn', HTMLButtonElement),
    exportBtn: requireElement('exportBtn', HTMLButtonElement),
    scheduleStatus: requireElement('scheduleStatus', HTMLElement),
    focusStatus: requireElement('focusStatus', HTMLElement),
    scheduleConfigSection: requireElement('scheduleConfigSection', HTMLElement),
    focusConfigSection: requireElement('focusConfigSection', HTMLElement),
    focusSheetsConfig: requireElement('focusSheetsConfig', HTMLElement),
    schedulePreview: requireElement('schedulePreview', HTMLTableElement),
    scheduleIdCol: requireElement('scheduleIdCol', HTMLSelectElement),
    scheduleNameCol: requireElement('scheduleNameCol', HTMLSelectElement),
    actionSection: requireElement('actionSection', HTMLElement),
    resultStats: requireElement('resultStats', HTMLElement)
};

const logic = createFocusCrewLogic(XLSX);
const CATEGORY_CONFIG = logic.CATEGORY_CONFIG;

document.addEventListener('DOMContentLoaded', function() {
    elements.scheduleFile.addEventListener('change', handleScheduleFile);
    elements.focusFile.addEventListener('change', handleFocusFile);
    elements.highlightBtn.addEventListener('click', doHighlight);
    elements.exportBtn.addEventListener('click', exportExcel);
});

function requireElement<T extends HTMLElement>(id: string, Type: { new(): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof Type)) {
        throw new Error(`页面缺少必要元素：${id}`);
    }
    return element;
}

async function handleScheduleFile(e: Event) {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;

    try {
        const data = new Uint8Array(await file.arrayBuffer());
        scheduleWorkbook = XLSX.read(data, {type: 'array'});
        showStatus('scheduleStatus', '已加载: ' + file.name, 'success');
        loadSchedulePreview();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showStatus('scheduleStatus', '文件解析失败: ' + message, 'error');
    }
}

async function handleFocusFile(e: Event) {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;

    try {
        const data = new Uint8Array(await file.arrayBuffer());
        focusWorkbook = XLSX.read(data, {type: 'array'});
        showStatus('focusStatus', '已加载: ' + file.name, 'success');
        loadFocusPreview();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showStatus('focusStatus', '文件解析失败: ' + message, 'error');
    }
}

function showStatus(id: 'scheduleStatus' | 'focusStatus', msg: string, type: 'success' | 'error') {
    const el = elements[id];
    el.textContent = msg;
    el.className = 'status status-' + type;
}

function loadSchedulePreview() {
    if (!scheduleWorkbook) return;
    
    const sheet = scheduleWorkbook.Sheets[scheduleWorkbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<FocusCrewJsonRow>(sheet, {header: 1, raw: false});
    
    if (json.length === 0) {
        showStatus('scheduleStatus', '表格为空', 'error');
        return;
    }
    
    scheduleColumns = (json[0] || []).map((c, i) => c ? String(c) : '列' + (i+1));
    scheduleData = json;
    
    renderPreview(elements.schedulePreview, scheduleColumns, json.slice(0, 6));
    renderSelectors(elements.scheduleIdCol, elements.scheduleNameCol, scheduleColumns);
    
    elements.scheduleConfigSection.style.display = 'block';
    checkReady();
}

function loadFocusPreview() {
    if (!focusWorkbook) return;
    
    focusSheets = logic.parseFocusWorkbook(focusWorkbook);
    
    if (focusSheets.length === 0) {
        showStatus('focusStatus', '未找到有效的关注类别工作表', 'error');
        return;
    }
    
    renderFocusSheets(elements.focusSheetsConfig, focusSheets, CATEGORY_CONFIG);
    
    showStatus('focusStatus', '已加载 ' + focusSheets.length + ' 个关注类别工作表', 'success');
    
    elements.focusConfigSection.style.display = 'block';
    checkReady();
}

function checkReady() {
    if (scheduleData.length > 0 && focusSheets.length > 0) {
        elements.actionSection.style.display = 'block';
    }
}

function doHighlight() {
    const scheduleNameCol = Number.parseInt(elements.scheduleNameCol.value, 10);
    
    if (isNaN(scheduleNameCol)) {
        alert('请选择审班表的姓名列');
        return;
    }
    if (!scheduleWorkbook) {
        alert('请先上传审班表');
        return;
    }
    
    const nameColumnBySheetIndex: Record<number, number> = {};
    
    for (let sheetIdx = 0; sheetIdx < focusSheets.length; sheetIdx++) {
        const sheetInfo = focusSheets[sheetIdx];
        const nameColSelect = document.getElementById('focusNameCol_' + sheetIdx);
        
        if (!(nameColSelect instanceof HTMLSelectElement)) {
            console.warn('未找到工作表 [' + sheetInfo.name + '] 的姓名列选择器');
            continue;
        }
        
        const nameCol = Number.parseInt(nameColSelect.value, 10);
        
        if (isNaN(nameCol)) {
            alert('请选择 [' + sheetInfo.name + '] 的姓名列');
            return;
        }

        nameColumnBySheetIndex[sheetIdx] = nameCol;
    }
    
    const focusResult = logic.collectFocusData(focusSheets, nameColumnBySheetIndex);
    const focusNames = focusResult.focusNames;
    console.log('重点人员总数:', focusNames.length);
    console.log('重点人员示例:', focusNames.slice(0, 10));
    
    if (focusNames.length === 0) {
        alert('未找到任何重点人员，请检查重点人员表的姓名列是否选择正确');
        return;
    }
    
    const highlightResult = logic.buildHighlightedWorkbook(scheduleWorkbook, scheduleNameCol, focusResult.focusData);
    resultWorkbook = highlightResult.workbook;
    Object.keys(highlightResult.sheetMatchCounts).forEach(sheetName => {
        console.log('工作表 [' + sheetName + '] 匹配到 ' + highlightResult.sheetMatchCounts[sheetName] + ' 人');
    });
    
    displayStats(elements.resultStats, focusNames.length, highlightResult.matchedCategories, CATEGORY_CONFIG);
    elements.exportBtn.disabled = false;
}

function exportExcel() {
    if (!resultWorkbook) {
        alert('请先进行标注');
        return;
    }
    XLSX.writeFile(resultWorkbook, '审班表_已标注.xlsx');
}
