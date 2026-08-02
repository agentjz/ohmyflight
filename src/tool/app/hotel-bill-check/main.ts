import type * as XLSX from "xlsx-js-style";

import { createAppContext } from "./app-context";
import { exportExcel } from "./export-actions";
import { handleBillFile, handleCheckinFile, loadBillPreview, loadCheckinPreview } from "./file-actions";
import { matchRows } from "./logic";
import type { HotelBillContext } from "./models";
import { renderResults } from "./view";

function doMatch(context: HotelBillContext): void {
        const billNameCol = Number.parseInt(context.getInput('billNameCol').value, 10);
        const billDateCol = Number.parseInt(context.getInput('billDateCol').value, 10);
        const checkinNameCol = Number.parseInt(context.getInput('checkinNameCol').value, 10);
        const checkinDateCol = Number.parseInt(context.getInput('checkinDateCol').value, 10);
        const tolerance = Number.parseInt(context.getInput('dateTolerance').value, 10);

        if (Number.isNaN(billNameCol) || Number.isNaN(billDateCol) || Number.isNaN(checkinNameCol) || Number.isNaN(checkinDateCol)) {
            alert('请选择所有必需的列');
            return;
        }

        const matchOutput = matchRows({
            billData: context.state.billData,
            checkinData: context.state.checkinData,
            billNameCol,
            billDateCol,
            checkinNameCol,
            checkinDateCol,
            tolerance
        });

        context.state.matchResults = matchOutput.results;
        renderResults(context);
        context.getButton('exportBtn').disabled = false;
    }

function bindEvents(context: HotelBillContext): void {
        context.getInput('billFile').addEventListener('change', event => handleBillFile(context, event));
        context.getInput('checkinFile').addEventListener('change', event => handleCheckinFile(context, event));
        context.getInput('billHeaderRow').addEventListener('change', () => loadBillPreview(context));
        context.getInput('checkinHeaderRow').addEventListener('change', () => loadCheckinPreview(context));
        context.getButton('matchBtn').addEventListener('click', () => doMatch(context));
        context.getButton('exportBtn').addEventListener('click', () => exportExcel(context));
    }

    document.addEventListener('DOMContentLoaded', function () {
        const xlsx = window.XLSX as unknown as typeof XLSX;
        const context = createAppContext(xlsx);
        bindEvents(context);
    });
