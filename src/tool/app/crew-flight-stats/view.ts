import type { CrewFlightStatsContext } from "./models";

export function displaySheetSelector(context: CrewFlightStatsContext, sheetNames: string[]): void {
        context.elements.sheetSection.style.display = 'block';
        context.state.selectedSheets = [...sheetNames];

        context.elements.sheetSelector.innerHTML = sheetNames.map(name => `
            <label class="sheet-checkbox checked">
                <input type="checkbox" value="${name}" checked>
                <span>${name}</span>
            </label>
        `).join('');

        context.elements.sheetSelector.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', function () {
                const label = this.parentElement;
                if (this.checked) {
                    label?.classList.add('checked');
                    if (!context.state.selectedSheets.includes(this.value)) {
                        context.state.selectedSheets.push(this.value);
                    }
                } else {
                    label?.classList.remove('checked');
                    context.state.selectedSheets = context.state.selectedSheets.filter(sheet => sheet !== this.value);
                }
                context.checkReady();
            });
        });
    }
export function renderWarnings(context: CrewFlightStatsContext, unmatchedCells: string[]): void {
        if (unmatchedCells.length > 0) {
            context.elements.warningSection.style.display = 'block';
            context.elements.warningList.innerHTML = unmatchedCells.slice(0, 30).join('<br>') +
                (unmatchedCells.length > 30 ? `<br>...还有 ${unmatchedCells.length - 30} 条` : '');
        } else {
            context.elements.warningSection.style.display = 'none';
        }
    }

export function displayResult(context: CrewFlightStatsContext): void {
        if (!context.state.statsResult) return;

        context.elements.resultSection.style.display = 'block';
        const people = context.getPeopleInRosterOrder();
        context.elements.resultInfo.textContent = `共统计 ${people.length} 人，${context.state.routes.length} 条航线，已选择 ${context.state.selectedSheets.length} 个工作表`;

        context.elements.resultHead.innerHTML = '<tr><th>加分项</th>' +
            context.state.routes.map(route => `<th>${route}</th>`).join('') +
            '</tr>';

        context.elements.resultBody.innerHTML = people.map(name => {
            const cells = context.state.routes.map(route => `<td>${context.state.statsResult?.[name]?.[route] || ''}</td>`).join('');
            return `<tr><td>${name}</td>${cells}</tr>`;
        }).join('');
    }
