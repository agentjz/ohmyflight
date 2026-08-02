import { extractNamesInTextOrder } from "./logic";
import type { CrewFlightStatsContext } from "./models";

const INITIAL_ROWS = 10;

export function createCrewRow(): HTMLTableRowElement {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 4px; border: 1px solid #d0d7de;">
                <input type="text" class="crew-input" style="width: 100%; padding: 4px 6px; border: 1px solid #d0d7de; border-radius: 4px; font-size: 13px;" placeholder="粘贴文本...">
            </td>
            <td style="padding: 4px; border: 1px solid #d0d7de;">
                <input type="text" class="crew-result" style="width: 100%; padding: 4px 6px; border: 1px solid #d0d7de; border-radius: 4px; font-size: 13px;" placeholder="识别结果">
            </td>
            <td style="padding: 4px; border: 1px solid #d0d7de; text-align: center;">
                <button class="btn btn-small copy-row-btn" style="padding: 2px 8px; font-size: 12px;">复制</button>
            </td>
        `;
        return row;
}
export function initCrewTable(context: CrewFlightStatsContext): void {
        context.elements.crewTableBody.innerHTML = '';
        for (let index = 0; index < INITIAL_ROWS; index++) {
            context.elements.crewTableBody.appendChild(createCrewRow());
        }
    }

    function extractAll(context: CrewFlightStatsContext): void {
        if (context.state.rosterNames.length === 0) {
            alert('请先加载机组花名册');
            return;
        }

        context.elements.crewTableBody.querySelectorAll('tr').forEach(row => {
            const input = row.querySelector<HTMLInputElement>('.crew-input');
            const result = row.querySelector<HTMLInputElement>('.crew-result');
            if (!input || !result) return;
            const text = input.value.trim();
            if (text) {
                result.value = extractNamesInTextOrder(text, context.state.rosterNames).join(' ');
            }
        });
    }
    function clearAll(context: CrewFlightStatsContext): void {
        context.elements.crewTableBody.querySelectorAll('tr').forEach(row => {
            const input = row.querySelector<HTMLInputElement>('.crew-input');
            const result = row.querySelector<HTMLInputElement>('.crew-result');
            if (input) input.value = '';
            if (result) result.value = '';
        });
    }

export function bindCrewExtractActions(context: CrewFlightStatsContext): void {
        initCrewTable(context);
        context.elements.extractAllBtn.addEventListener('click', () => extractAll(context));
        context.elements.clearAllBtn.addEventListener('click', () => clearAll(context));
        context.elements.addRowBtn.addEventListener('click', () => {
            context.elements.crewTableBody.appendChild(createCrewRow());
        });
        context.elements.crewTableBody.addEventListener('click', event => {
            const target = event.target;
            if (target instanceof HTMLElement && target.classList.contains('copy-row-btn')) {
                const row = target.closest('tr');
                const resultInput = row?.querySelector<HTMLInputElement>('.crew-result');
                const result = resultInput?.value || '';
                if (!result) return;
                navigator.clipboard.writeText(result).then(() => {
                    target.textContent = '已复制';
                    target.style.backgroundColor = '#1a7f37';
                    target.style.color = '#fff';
                    setTimeout(() => {
                        target.textContent = '复制';
                        target.style.backgroundColor = '';
                        target.style.color = '';
                    }, 1500);
                }).catch(() => {
                    alert('复制失败');
                });
            }
        });
    }
