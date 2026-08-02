import type {
    SeasonalLearningAllocationGroupInput,
    SeasonalLearningAllocationResult
} from "./models";

    function validateCount(value: number, label: string): void {
        if (!Number.isInteger(value) || value < 0) {
            throw new Error(`${label}人数必须是非负整数。`);
        }
    }

    function distributeCount(count: number, totals: number[]): number[] {
        const periodCount = totals.length;
        const base = Math.floor(count / periodCount);
        const remainder = count % periodCount;
        const counts = Array(periodCount).fill(base) as number[];

        totals.forEach((_, periodIndex) => {
            totals[periodIndex] += base;
        });
        const periodOrder = Array.from({ length: periodCount }, (_, periodIndex) => periodIndex)
            .sort((left, right) => totals[left] - totals[right] || left - right);
        periodOrder.slice(0, remainder).forEach((periodIndex) => {
            counts[periodIndex] += 1;
            totals[periodIndex] += 1;
        });
        return counts;
    }

    function buildDynamicQuotas(
        groups: SeasonalLearningAllocationGroupInput[],
        neutralCount: number,
        periodCount: number
    ): SeasonalLearningAllocationResult {
        if (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 30) {
            throw new Error("期数必须是 1 到 30 的整数。");
        }
        validateCount(neutralCount, "中性人员");
        const groupIds = new Set<string>();
        const totalCounts = Array(periodCount).fill(0) as number[];
        const groupCounts = Object.create(null) as Record<string, number[]>;

        groups.forEach((group) => {
            if (!group.id || groupIds.has(group.id)) throw new Error("均衡组标识必须唯一。");
            validateCount(group.count, group.id);
            groupIds.add(group.id);
            groupCounts[group.id] = distributeCount(group.count, totalCounts);
        });
        const neutralCounts = distributeCount(neutralCount, totalCounts);
        return { groupCounts, neutralCounts, totalCounts };
    }

export const SeasonalLearningAllocation = { buildDynamicQuotas };
