import { getProofLinks } from "./logic";
import type { HotelBillContext, HotelBillWorkbookRow } from "./models";

export function showStatus(context: HotelBillContext, id: string, message: string, type: string): void {
        const element = context.getElement(id);
        element.textContent = message;
        element.className = 'status status-' + type;
    }
export function renderPreview(context: HotelBillContext, type: string, columns: string[], rows: HotelBillWorkbookRow[]): void {
        const table = context.getElement(type + 'Preview');
        let html = '<thead><tr>';
        columns.forEach(column => { html += '<th>' + column + '</th>'; });
        html += '</tr></thead><tbody>';
        rows.forEach(row => {
            html += '<tr>';
            columns.forEach((_, index) => {
                const value = row[index] !== undefined ? row[index] : '';
                html += '<td title="' + value + '">' + value + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody>';
        table.innerHTML = html;
    }

export function renderColumnSelectors(context: HotelBillContext, type: string, columns: string[]): void {
        const nameSelect = context.getInput(type + 'NameCol');
        const dateSelect = context.getInput(type + 'DateCol');

        nameSelect.innerHTML = '<option value="">请选择...</option>';
        dateSelect.innerHTML = '<option value="">请选择...</option>';

        columns.forEach((column, index) => {
            const option = '<option value="' + index + '">' + column + '</option>';
            nameSelect.innerHTML += option;
            dateSelect.innerHTML += option;
        });

        columns.forEach((column, index) => {
            const lower = column.toLowerCase();
            if (lower.includes('姓名') || lower.includes('人员信息') || lower.includes('入住人员')) {
                nameSelect.value = String(index);
            }
            if (lower.includes('入住时间') || lower.includes('入住日期') || lower.includes('您入住的时间')) {
                dateSelect.value = String(index);
            }
        });
    }

export function renderDisplayCols(context: HotelBillContext, type: string, columns: string[]): void {
        const container = context.getElement(type + 'DisplayCols');
        container.innerHTML = '';

        const defaultBill = ['入住时间', '退房时间', '入住事由', '住宿天数', '入住人员信息'];
        const defaultCheckin = ['您的姓名', '您入住的时间', '您需要入住天数', '您的分部', '入住证明'];
        const defaults = type === 'bill' ? defaultBill : defaultCheckin;

        columns.forEach((column, index) => {
            const shouldCheck = defaults.some(item => column.includes(item) || item.includes(column));
            const label = document.createElement('label');
            label.innerHTML = '<input type="checkbox" name="' + type + '_display" value="' + index + '" ' + (shouldCheck ? 'checked' : '') + '><span>' + column + '</span>';
            container.appendChild(label);
        });
    }

export function getSelectedCols(type: string): number[] {
        return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="' + type + '_display"]:checked'))
            .map(checkbox => Number.parseInt(checkbox.value, 10));
    }

export function renderResults(context: HotelBillContext): void {
        const billDisplayCols = getSelectedCols('bill');
        const checkinDisplayCols = getSelectedCols('checkin');
        const matched = context.state.matchResults.filter(row => row.status === 'matched').length;
        const duplicate = context.state.matchResults.filter(row => row.status === 'duplicate').length;
        const unmatched = context.state.matchResults.filter(row => row.status === 'unmatched').length;

        context.getElement('totalCount').textContent = String(context.state.matchResults.length);
        context.getElement('matchedCount').textContent = String(matched + duplicate);
        context.getElement('unmatchedCount').textContent = String(unmatched);

        let headHtml = '<tr><th>状态</th>';
        billDisplayCols.forEach(index => { headHtml += '<th>[账单] ' + context.state.billColumns[index] + '</th>'; });
        checkinDisplayCols.forEach(index => { headHtml += '<th>[登记] ' + context.state.checkinColumns[index] + '</th>'; });
        headHtml += '<th>入住证明</th></tr>';
        context.getElement('resultHead').innerHTML = headHtml;

        let bodyHtml = '';
        context.state.matchResults.forEach(result => {
            bodyHtml += '<tr class="' + result.status + '">';
            bodyHtml += '<td><span class="status-badge ' + result.status + '">' + (result.status === 'matched' ? '匹配' : result.status === 'duplicate' ? '重复匹配' : '无登记') + '</span></td>';

            billDisplayCols.forEach(columnIndex => {
                const value = result.billRow[columnIndex] || '';
                const link = context.state.billHyperlinks[result.billIdx] && context.state.billHyperlinks[result.billIdx][columnIndex];
                bodyHtml += link ? '<td><a href="' + link.url + '" target="_blank" class="proof-link">' + link.display + '</a></td>' : '<td>' + value + '</td>';
            });

            if (result.checkinRow) {
                checkinDisplayCols.forEach(columnIndex => {
                    const value = result.checkinRow?.[columnIndex] || '';
                    const link = context.state.checkinHyperlinks[result.checkinIdx] && context.state.checkinHyperlinks[result.checkinIdx][columnIndex];
                    bodyHtml += link ? '<td><a href="' + link.url + '" target="_blank" class="proof-link">' + link.display + '</a></td>' : '<td>' + value + '</td>';
                });
            } else {
                checkinDisplayCols.forEach(() => { bodyHtml += '<td>-</td>'; });
            }

            bodyHtml += '<td>';
            getProofLinks(result, context.state.checkinColumns, context.state.checkinHyperlinks).forEach(link => {
                bodyHtml += '<a href="' + link.url + '" target="_blank" class="proof-link">' + link.display + '</a> ';
            });
            bodyHtml += '</td></tr>';
        });

        context.getElement('resultBody').innerHTML = bodyHtml;
        context.getElement('resultSection').style.display = 'block';
    }
