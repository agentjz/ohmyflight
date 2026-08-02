import type * as XLSX from "xlsx-js-style";

import { getPeopleInRosterOrder } from "./logic";
import type { CrewFlightStatsContext, CrewFlightStatsElements, CrewFlightStatsState } from "./models";

function requireElement<T extends HTMLElement>(id: string, Type: { new(): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof Type)) {
        throw new Error(`页面缺少必要元素：${id}`);
    }
    return element;
}

function createElements(): CrewFlightStatsElements {
    return {
            scheduleFile: requireElement('scheduleFile', HTMLInputElement),
            rosterFile: requireElement('rosterFile', HTMLInputElement),
            rosterStatus: requireElement('rosterStatus', HTMLElement),
            scheduleStatus: requireElement('scheduleStatus', HTMLElement),
            sheetSection: requireElement('sheetSection', HTMLElement),
            sheetSelector: requireElement('sheetSelector', HTMLElement),
            selectAllBtn: requireElement('selectAllBtn', HTMLButtonElement),
            selectNoneBtn: requireElement('selectNoneBtn', HTMLButtonElement),
            analyzeBtn: requireElement('analyzeBtn', HTMLButtonElement),
            exportBtn: requireElement('exportBtn', HTMLButtonElement),
            warningSection: requireElement('warningSection', HTMLElement),
            warningList: requireElement('warningList', HTMLElement),
            resultSection: requireElement('resultSection', HTMLElement),
            resultHead: requireElement('resultHead', HTMLTableSectionElement),
            resultBody: requireElement('resultBody', HTMLTableSectionElement),
            resultInfo: requireElement('resultInfo', HTMLElement),
            crewTableBody: requireElement('crewTableBody', HTMLTableSectionElement),
            extractAllBtn: requireElement('extractAllBtn', HTMLButtonElement),
            clearAllBtn: requireElement('clearAllBtn', HTMLButtonElement),
            addRowBtn: requireElement('addRowBtn', HTMLButtonElement)
    };
}

export function createAppContext(xlsx: typeof XLSX): CrewFlightStatsContext {
    const state: CrewFlightStatsState = {
            scheduleWorkbook: null,
            rosterNames: [],
            statsResult: null,
            routes: [],
            selectedSheets: []
    };

    const context: CrewFlightStatsContext = {
            XLSX: xlsx,
            elements: createElements(),
            state,
            showStatus(id, msg, type) {
                const element = context.elements[id];
                element.textContent = msg;
                element.className = 'status status-' + type;
            },
            checkReady() {
                const ready = !!context.state.scheduleWorkbook && context.state.rosterNames.length > 0 && context.state.selectedSheets.length > 0;
                context.elements.analyzeBtn.disabled = !ready;
            },
            getPeopleInRosterOrder() {
                return getPeopleInRosterOrder(context.state.statsResult, context.state.rosterNames);
            }
        };

    return context;
}
