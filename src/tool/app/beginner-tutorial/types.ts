export type TutorialStatus = "confirmed" | "partial" | "special";
export type TutorialModuleKind = "markdown" | "path" | "levels" | "records" | "recovery" | "numbers" | "evidence";

export interface TutorialSourceRef {
    id: string;
    manual: string;
    version: string;
    chapter: string;
    section: string;
}

export interface TutorialStep {
    id: string;
    title: string;
    summary: string;
    sourceIds?: string[];
    sources: TutorialSourceRef[];
}

export interface TutorialSection {
    title: string;
    items: string[];
}

export interface TutorialRecord {
    id: string;
    title: string;
    status: TutorialStatus;
    category: string;
    track?: string;
    audience: string;
    summary: string;
    action: string;
    lifecycle: string;
    sections?: TutorialSection[];
    sourceIds?: string[];
    sources: TutorialSourceRef[];
}

export interface TutorialModule {
    id: string;
    title: string;
    kind: TutorialModuleKind;
    summary: string;
    progression?: string;
    body?: string;
    bodyFile?: string;
    steps?: TutorialStep[];
    records?: TutorialRecord[];
    sourceIds?: string[];
    sources?: TutorialSourceRef[];
}

export interface BeginnerTutorialData {
    schemaVersion: 1;
    title: string;
    description: string;
    sourceScope: TutorialSourceRef[];
    modules: TutorialModule[];
}
