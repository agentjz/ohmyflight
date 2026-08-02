import type {
    FocusCrewCategory,
    FocusCrewCategoryConfigEntry,
    FocusCrewCategoryTotals,
    FocusCrewJsonRow,
    FocusSheetInfo
} from "./models";

export function renderFocusSheets(
        container: HTMLElement,
        focusSheets: FocusSheetInfo[],
        categoryConfig: Record<FocusCrewCategory, FocusCrewCategoryConfigEntry>
    ) {
        let html = '';
        
        focusSheets.forEach((sheetInfo, sheetIdx) => {
            const badgeClass = 'badge-' + categoryConfig[sheetInfo.category].priority;
            
            html += '<div class="sheet-config">';
            html += '<div class="sheet-config-title">' + sheetInfo.name;
            html += '<span class="badge ' + badgeClass + '">' + categoryConfig[sheetInfo.category].label + '</span>';
            html += '</div>';
            
            html += '<div class="config-row">';
            
            html += '<div class="config-item"><label>员工号列:</label>';
            html += '<select id="focusIdCol_' + sheetIdx + '">';
            html += '<option value="">请选择...</option>';
            sheetInfo.columns.forEach((col, colIdx) => {
                const selected = (col.includes('员工号') || col === '员工号') ? ' selected' : '';
                html += '<option value="' + colIdx + '"' + selected + '>' + col + '</option>';
            });
            html += '</select></div>';
            
            html += '<div class="config-item"><label>姓名列:</label>';
            html += '<select id="focusNameCol_' + sheetIdx + '">';
            html += '<option value="">请选择...</option>';
            sheetInfo.columns.forEach((col, colIdx) => {
                const selected = (col.includes('姓名') || col === '姓名') ? ' selected' : '';
                html += '<option value="' + colIdx + '"' + selected + '>' + col + '</option>';
            });
            html += '</select></div>';
            
            html += '</div>';
            
            html += '<div class="preview-wrapper"><table class="preview-table">';
            html += '<thead><tr>';
            sheetInfo.columns.forEach((col, i) => { 
                html += '<th title="列索引:' + i + '">' + col + '</th>'; 
            });
            html += '</tr></thead><tbody>';
            
            const previewRows = sheetInfo.data.slice(2, 7);
            previewRows.forEach(row => {
                html += '<tr>';
                sheetInfo.columns.forEach((_, i) => {
                    const val = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
                    const display = val.length > 20 ? val.substring(0, 20) + '...' : val;
                    html += '<td title="' + val + '">' + display + '</td>';
                });
                html += '</tr>';
            });
            
            html += '</tbody></table></div>';
            html += '</div>';
        });
        
        container.innerHTML = html;
    }
export function renderPreview(table: HTMLTableElement, columns: string[], rows: FocusCrewJsonRow[]): void {
        let html = '<thead><tr>';
        columns.forEach((col, i) => { 
            html += '<th title="列索引:' + i + '">' + col + '</th>'; 
        });
        html += '</tr></thead><tbody>';
        rows.forEach(row => {
            html += '<tr>';
            columns.forEach((_, i) => {
                const val = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
                const display = val.length > 20 ? val.substring(0, 20) + '...' : val;
                html += '<td title="' + val + '">' + display + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody>';
        table.innerHTML = html;
    }

export function renderSelectors(idSelect: HTMLSelectElement, nameSelect: HTMLSelectElement, columns: string[]): void {
        idSelect.innerHTML = '<option value="">请选择...</option>';
        nameSelect.innerHTML = '<option value="">请选择...</option>';
        
        columns.forEach((col, i) => {
            const opt = '<option value="' + i + '">' + col + '</option>';
            idSelect.innerHTML += opt;
            nameSelect.innerHTML += opt;
        });
        
        columns.forEach((col, i) => {
            if (col.includes('员工号') || col === '员工号') {
                idSelect.value = String(i);
            }
            if (col.includes('姓名') || col === '姓名') {
                nameSelect.value = String(i);
            }
        });
    }

export function displayStats(
        statsDiv: HTMLElement,
        totalFocus: number,
        matchedCategories: FocusCrewCategoryTotals,
        categoryConfig: Record<FocusCrewCategory, FocusCrewCategoryConfigEntry>
    ) {
        statsDiv.style.display = 'block';
        
        let html = '<div class="stats-item">重点人员总数: <span class="stats-num">' + totalFocus + '</span></div>';
        
        const sortedCategories = Object.keys(matchedCategories).sort((a, b) => {
            return categoryConfig[a as FocusCrewCategory].priority - categoryConfig[b as FocusCrewCategory].priority;
        });
        
        for (const cat of sortedCategories) {
            const category = cat as FocusCrewCategory;
            const label = categoryConfig[category].label;
            const count = matchedCategories[category];
            html += '<div class="stats-item">' + label + ': <span class="stats-num">' + count + '</span></div>';
        }
        
        statsDiv.innerHTML = html;
    }
