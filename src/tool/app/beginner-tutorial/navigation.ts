import type {
    BeginnerTutorialData,
    TutorialNavigationOrigin
} from "./types";

export interface TutorialLocation {
    moduleId: string;
    recordId?: string;
}

export interface TutorialHistoryState extends TutorialLocation {
    origin?: TutorialNavigationOrigin;
}

export interface TutorialNavigationTransition {
    source?: { state: TutorialHistoryState; hash: string };
    target: { state: TutorialHistoryState; hash: string };
}

export function resolveTutorialHash(data: BeginnerTutorialData, hash: string): TutorialLocation {
    const [moduleId, recordId] = decodeURIComponent(hash.replace(/^#/, "")).split("/");
    return data.modules.some((module) => module.id === moduleId)
        ? { moduleId, ...(recordId ? { recordId } : {}) }
        : { moduleId: data.modules[0]?.id || "" };
}

export function encodeTutorialHash(moduleId: string, recordId?: string): string {
    const value = recordId ? `${moduleId}/${recordId}` : moduleId;
    return `#${encodeURIComponent(value)}`;
}

export function createTutorialNavigationTransition(
    moduleId: string,
    recordId?: string,
    origin?: TutorialNavigationOrigin
): TutorialNavigationTransition {
    return {
        ...(origin
            ? {
                source: {
                    state: { moduleId: origin.moduleId, recordId: origin.recordId },
                    hash: encodeTutorialHash(origin.moduleId, origin.recordId)
                }
            }
            : {}),
        target: {
            state: { moduleId, ...(recordId ? { recordId } : {}), ...(origin ? { origin } : {}) },
            hash: encodeTutorialHash(moduleId, recordId)
        }
    };
}

export function readTutorialOrigin(value: unknown): TutorialNavigationOrigin | undefined {
    if (!value || typeof value !== "object") return undefined;
    const origin = (value as Partial<TutorialHistoryState>).origin;
    return origin
        && typeof origin.moduleId === "string"
        && typeof origin.recordId === "string"
        && typeof origin.title === "string"
        ? origin
        : undefined;
}
