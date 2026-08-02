import type * as XLSX from "xlsx-js-style";

import type { HotelBillContext, HotelBillState } from "./models";

export function createState(): HotelBillState {
    return {
        billWorkbook: null,
        checkinWorkbook: null,
        billData: [],
        checkinData: [],
        billColumns: [],
        checkinColumns: [],
        billHyperlinks: {},
        checkinHyperlinks: {},
        matchResults: []
    };
}

export function createAppContext(xlsx: typeof XLSX): HotelBillContext {
    return {
        XLSX: xlsx,
        state: createState(),
        getInput(id: string): HTMLInputElement {
            return document.getElementById(id) as HTMLInputElement;
        },
        getButton(id: string): HTMLButtonElement {
            return document.getElementById(id) as HTMLButtonElement;
        },
        getElement(id: string): HTMLElement {
            return document.getElementById(id) as HTMLElement;
        }
    };
}
