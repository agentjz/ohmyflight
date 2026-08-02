import type {
    SeasonalLearningBalanceFilterDictionary,
    SeasonalLearningBalanceFilterEntry,
    SeasonalLearningPerson
} from "./models";

    const BALANCE_FILTERS: SeasonalLearningBalanceFilterDictionary = {
        identity: {
            values: ["公司领导"],
            reason: "公司领导计入总人数，不参与运行岗位和美线带队均衡。"
        }
    };

    const normalizedRules = (Object.entries(BALANCE_FILTERS) as Array<[
        keyof SeasonalLearningPerson,
        SeasonalLearningBalanceFilterEntry
    ]>).map(([field, rule]) => ({
        field,
        reason: rule.reason,
        values: new Set(rule.values.map((value) => value.trim()).filter(Boolean))
    }));

    function getOperationalIgnoreReason(person: SeasonalLearningPerson): string {
        for (const rule of normalizedRules) {
            const value = String(person[rule.field] ?? "").trim();
            if (rule.values.has(value)) return rule.reason;
        }
        return "";
    }

    function shouldIgnoreOperational(person: SeasonalLearningPerson): boolean {
        return Boolean(getOperationalIgnoreReason(person));
    }

export const SeasonalLearningBalanceFilter = {
        BALANCE_FILTERS,
        shouldIgnoreOperational,
        getOperationalIgnoreReason
    };
