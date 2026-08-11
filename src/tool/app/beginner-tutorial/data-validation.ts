import type {
    BeginnerTutorialData,
    TutorialEmbeddedRecord,
    TutorialModule,
    TutorialRecord,
    TutorialRecordBase,
    TutorialRecordLink,
    TutorialSection,
    TutorialSourceRef
} from "./types";

export function isBeginnerTutorialData(value: unknown): value is BeginnerTutorialData {
    if (!value || typeof value !== "object") return false;
    const data = value as Partial<BeginnerTutorialData>;
    return data.schemaVersion === 1
        && typeof data.title === "string"
        && typeof data.description === "string"
        && Array.isArray(data.sourceScope)
        && data.sourceScope.every(isSourceRef)
        && Array.isArray(data.modules)
        && data.modules.every(isModule);
}

function isModule(value: unknown): value is TutorialModule {
    if (!value || typeof value !== "object") return false;
    const module = value as Partial<TutorialModule>;
    return typeof module.id === "string"
        && typeof module.title === "string"
        && typeof module.kind === "string"
        && typeof module.summary === "string"
        && (module.sources === undefined || module.sources.every(isSourceRef))
        && (module.records === undefined || module.records.every(isRecord));
}

function isRecord(value: unknown): value is TutorialRecord {
    if (!value || typeof value !== "object") return false;
    const record = value as Partial<TutorialRecord>;
    const requiredStrings: Array<keyof TutorialRecordBase> = [
        "id",
        "title",
        "status",
        "category",
        "audience",
        "summary",
        "action",
        "lifecycle"
    ];
    return requiredStrings.every((key) => typeof record[key] === "string")
        && Array.isArray(record.sources)
        && record.sources.every(isSourceRef)
        && (record.sections === undefined || record.sections.every(isSection))
        && (record.embeddedRecords === undefined || record.embeddedRecords.every(isEmbeddedRecord))
        && (record.relatedRecords === undefined || record.relatedRecords.every(isRecordLink));
}

function isEmbeddedRecord(value: unknown): value is TutorialEmbeddedRecord {
    return isRecord(value)
        && typeof (value as TutorialEmbeddedRecord).moduleId === "string";
}

function isRecordLink(value: unknown): value is TutorialRecordLink {
    if (!value || typeof value !== "object") return false;
    const link = value as Partial<TutorialRecordLink>;
    return typeof link.moduleId === "string"
        && typeof link.targetId === "string"
        && typeof link.title === "string";
}

function isSection(value: unknown): value is TutorialSection {
    if (!value || typeof value !== "object") return false;
    const section = value as Partial<TutorialSection>;
    return typeof section.title === "string"
        && Array.isArray(section.items)
        && section.items.every((item) => typeof item === "string");
}

function isSourceRef(value: unknown): value is TutorialSourceRef {
    if (!value || typeof value !== "object") return false;
    const source = value as Partial<TutorialSourceRef>;
    return typeof source.id === "string"
        && typeof source.manual === "string"
        && typeof source.version === "string"
        && typeof source.chapter === "string"
        && typeof source.section === "string";
}
