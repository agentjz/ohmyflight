import { parseRosterRows } from "./logic";
import type { CrewFlightStatsContext } from "./models";
import { displaySheetSelector } from "./view";

const ROSTER_PATH = '../../../template/机组花名册.xlsx';

export async function loadDefaultRoster(context: CrewFlightStatsContext): Promise<void> {
        try {
            context.showStatus('rosterStatus', '正在加载默认花名册...', 'loading');
            const response = await fetch(ROSTER_PATH);
            if (!response.ok) throw new Error('文件不存在');
            const buffer = await response.arrayBuffer();
            parseRosterData(context, new Uint8Array(buffer), '机组花名册.xlsx');
        } catch (error) {
            console.error('自动加载花名册失败:', error);
            context.showStatus('rosterStatus', '请选择机组花名册文件', 'hint');
        }
    }
export function parseRosterData(context: CrewFlightStatsContext, data: Uint8Array, fileName: string): void {
        try {
            const workbook = context.XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = context.XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
            context.state.rosterNames = parseRosterRows(rows);
            context.showStatus('rosterStatus', `已加载: ${fileName}（${context.state.rosterNames.length} 人）`, 'success');
            context.checkReady();
        } catch (error) {
            context.showStatus('rosterStatus', '文件解析失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        }
    }

export async function handleScheduleFile(context: CrewFlightStatsContext, event: Event): Promise<void> {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const file = target.files?.[0];
        if (!file) return;

        try {
            const data = new Uint8Array(await file.arrayBuffer());
            context.state.scheduleWorkbook = context.XLSX.read(data, { type: 'array' });
            const sheetNames = context.state.scheduleWorkbook.SheetNames;
            context.showStatus('scheduleStatus', `已加载: ${file.name}（${sheetNames.length} 个工作表）`, 'success');
            displaySheetSelector(context, sheetNames);
            context.checkReady();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            context.showStatus('scheduleStatus', '文件解析失败: ' + message, 'error');
        }
    }

export async function handleRosterFile(context: CrewFlightStatsContext, event: Event): Promise<void> {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        const file = target.files?.[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        parseRosterData(context, new Uint8Array(buffer), file.name);
    }

export function bindFileActions(context: CrewFlightStatsContext): void {
        context.elements.scheduleFile.addEventListener('change', event => { void handleScheduleFile(context, event); });
        context.elements.rosterFile.addEventListener('change', event => { void handleRosterFile(context, event); });
        void loadDefaultRoster(context);
    }
