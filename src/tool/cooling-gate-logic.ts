const COOLING_ACCESS_KEY = "unlock";
export const RAPID_CLICK_WINDOW_MS = 700;

export interface CoolingClickState {
    buttonKey: string;
    count: number;
    lastClickedAt: number;
}

export function matchesCoolingAccessKey(input: string): boolean {
    return input.trim().toLowerCase() === COOLING_ACCESS_KEY;
}

export function isHomepageToolHidden(
    homepageState: string | undefined,
    homepageVisibility: string | undefined
): boolean {
    return homepageVisibility === "hidden" || homepageState === "cooling";
}

export function registerCoolingClick(
    state: CoolingClickState,
    buttonKey: string,
    timestamp: number,
    windowMs = RAPID_CLICK_WINDOW_MS
): { state: CoolingClickState; matched: boolean } {
    const sameButton = state.buttonKey === buttonKey;
    const withinWindow = timestamp >= state.lastClickedAt
        && timestamp - state.lastClickedAt <= windowMs;
    const nextState: CoolingClickState = {
        buttonKey,
        count: sameButton && withinWindow ? state.count + 1 : 1,
        lastClickedAt: timestamp
    };
    return {
        state: nextState,
        matched: nextState.count >= 3
    };
}

export const coolingGateLogic = {
    matches: matchesCoolingAccessKey,
    isHomepageToolHidden,
    registerClick: registerCoolingClick
};
