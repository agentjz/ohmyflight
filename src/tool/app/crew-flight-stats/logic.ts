import type { CrewFlightAnalyzeResult, CrewFlightSheetRows, CrewFlightStatsMap } from "./models";

function normalizeCrewText(value: unknown): string {
    return String(value ?? "").trim();
}
export function parseRosterRows(rows: unknown[][]): string[] {
    const names: string[] = [];
    for (let index = 1; index < rows.length; index++) {
        const name = normalizeCrewText(rows[index]?.[1]);
        if (name) names.push(name);
    }
    return names;
}

export function matchNamesInRosterOrder(cellContent: unknown, rosterNames: string[]): string[] {
    const content = normalizeCrewText(cellContent);
    if (!content) return [];
    return rosterNames.filter(name => content.includes(name));
}

export function extractNamesInTextOrder(text: unknown, rosterNames: string[]): string[] {
    const content = normalizeCrewText(text);
    if (!content) return [];

    return rosterNames
        .map(name => ({ name, index: content.indexOf(name) }))
        .filter(item => item.index !== -1)
        .sort((left, right) => left.index - right.index)
        .map(item => item.name);
}

export function analyzeScheduleRows(sheets: CrewFlightSheetRows[], rosterNames: string[]): CrewFlightAnalyzeResult {
    const statsResult: CrewFlightStatsMap = {};
    const routes: string[] = [];
    const unmatchedCells: string[] = [];

    sheets.forEach(sheet => {
        for (let rowIdx = 1; rowIdx < sheet.rows.length; rowIdx++) {
            const row = sheet.rows[rowIdx];
            const routeName = normalizeCrewText(row?.[0]);
            if (!routeName) continue;

            if (!routes.includes(routeName)) {
                routes.push(routeName);
            }

            for (let colIdx = 1; colIdx < row.length; colIdx++) {
                const cellContent = row[colIdx];
                const content = normalizeCrewText(cellContent);
                if (!content) continue;

                const matched = matchNamesInRosterOrder(content, rosterNames);
                matched.forEach(name => {
                    statsResult[name] = statsResult[name] || {};
                    statsResult[name][routeName] = (statsResult[name][routeName] || 0) + 1;
                });

                if (matched.length === 0) {
                    unmatchedCells.push(`[${sheet.sheetName}] 行${rowIdx + 1} ${routeName}: ${content.substring(0, 50)}`);
                }
            }
        }
    });

    return { statsResult, routes, unmatchedCells };
}

export function getPeopleInRosterOrder(statsResult: CrewFlightStatsMap | null, rosterNames: string[]): string[] {
    if (!statsResult) return [];

    const people: string[] = [];
    const added = new Set<string>();

    rosterNames.forEach(name => {
        if (statsResult[name] && !added.has(name)) {
            people.push(name);
            added.add(name);
        }
    });

    Object.keys(statsResult).sort().forEach(name => {
        if (!added.has(name)) {
            people.push(name);
        }
    });

    return people;
}

export function buildCrewFlightExportRows(statsResult: CrewFlightStatsMap, routes: string[], rosterNames: string[]): Array<Array<string | number>> {
    const rows: Array<Array<string | number>> = [["加分项", ...routes]];
    getPeopleInRosterOrder(statsResult, rosterNames).forEach(name => {
        rows.push([name, ...routes.map(route => statsResult[name]?.[route] || "")]);
    });
    return rows;
}
