(function () {
    const CATEGORY_ORDER: SeasonalLearningCategory[] = ["leader", "captain", "firstOfficer"];

    function buildUsLineLeaderQuotas(
        people: SeasonalLearningPerson[],
        categoryQuotas: Record<SeasonalLearningCategory, number[]>,
        periodCount: number
    ): Record<SeasonalLearningCategory, number[]> {
        interface FlowEdge {
            to: number;
            reverse: number;
            capacity: number;
            initialCapacity: number;
        }

        const categoryStart = 1;
        const periodStart = categoryStart + CATEGORY_ORDER.length;
        const source = 0;
        const sink = periodStart + periodCount;
        const superSource = sink + 1;
        const superSink = sink + 2;
        const graph: FlowEdge[][] = Array.from({ length: superSink + 1 }, () => []);
        const demands = Array(graph.length).fill(0) as number[];

        function addEdge(from: number, to: number, capacity: number): FlowEdge {
            const forward: FlowEdge = { to, reverse: graph[to].length, capacity, initialCapacity: capacity };
            const reverse: FlowEdge = { to: from, reverse: graph[from].length, capacity: 0, initialCapacity: 0 };
            graph[from].push(forward);
            graph[to].push(reverse);
            return forward;
        }

        function addBoundedEdge(from: number, to: number, minimum: number, maximum: number): FlowEdge {
            demands[from] -= minimum;
            demands[to] += minimum;
            return addEdge(from, to, maximum - minimum);
        }

        function maxFlow(from: number, to: number): number {
            let total = 0;
            while (true) {
                const parentNode = Array(graph.length).fill(-1) as number[];
                const parentEdge = Array(graph.length).fill(-1) as number[];
                const queue = [from];
                parentNode[from] = from;
                for (let cursor = 0; cursor < queue.length && parentNode[to] < 0; cursor += 1) {
                    const node = queue[cursor];
                    graph[node].forEach((edge, edgeIndex) => {
                        if (edge.capacity <= 0 || parentNode[edge.to] >= 0) return;
                        parentNode[edge.to] = node;
                        parentEdge[edge.to] = edgeIndex;
                        queue.push(edge.to);
                    });
                }
                if (parentNode[to] < 0) return total;
                let amount = Number.MAX_SAFE_INTEGER;
                for (let node = to; node !== from; node = parentNode[node]) {
                    amount = Math.min(amount, graph[parentNode[node]][parentEdge[node]].capacity);
                }
                for (let node = to; node !== from; node = parentNode[node]) {
                    const edge = graph[parentNode[node]][parentEdge[node]];
                    edge.capacity -= amount;
                    graph[node][edge.reverse].capacity += amount;
                }
                total += amount;
            }
        }

        const markedByCategory = CATEGORY_ORDER.map((category) => (
            people.filter((person) => person.category === category && person.isUsLineLeader).length
        ));
        const markedTotal = markedByCategory.reduce((sum, count) => sum + count, 0);
        const basePerPeriod = Math.floor(markedTotal / periodCount);
        const categoryPeriodEdges = CATEGORY_ORDER.map(() => Array<FlowEdge>(periodCount));

        markedByCategory.forEach((count, categoryIndex) => {
            addBoundedEdge(source, categoryStart + categoryIndex, count, count);
            categoryQuotas[CATEGORY_ORDER[categoryIndex]].forEach((capacity, periodIndex) => {
                categoryPeriodEdges[categoryIndex][periodIndex] = addBoundedEdge(
                    categoryStart + categoryIndex,
                    periodStart + periodIndex,
                    0,
                    capacity
                );
            });
        });
        for (let periodIndex = 0; periodIndex < periodCount; periodIndex += 1) {
            addBoundedEdge(periodStart + periodIndex, sink, basePerPeriod, basePerPeriod + 1);
        }
        addBoundedEdge(sink, source, 0, markedTotal);

        let requiredFlow = 0;
        demands.forEach((demand, node) => {
            if (demand > 0) {
                addEdge(superSource, node, demand);
                requiredFlow += demand;
            } else if (demand < 0) {
                addEdge(node, superSink, -demand);
            }
        });
        if (maxFlow(superSource, superSink) !== requiredFlow) {
            throw new Error("无法在岗位配额内均衡美线带队人员。");
        }

        return Object.fromEntries(CATEGORY_ORDER.map((category, categoryIndex) => [
            category,
            categoryPeriodEdges[categoryIndex].map((edge) => edge.initialCapacity - edge.capacity)
        ])) as Record<SeasonalLearningCategory, number[]>;
    }

    function buildBalancedQuotas(
        people: SeasonalLearningPerson[],
        periodCount: number
    ): SeasonalLearningAllocationQuotas {
        const categoryTotals = CATEGORY_ORDER.map((category) => (
            people.filter((person) => person.category === category).length
        ));
        const bases = categoryTotals.map((count) => Math.floor(count / periodCount));
        const remainders = categoryTotals.map((count) => count % periodCount);
        const extraTotal = remainders.reduce((sum, count) => sum + count, 0);
        const minimumExtrasPerPeriod = Math.floor(extraTotal / periodCount);
        const patterns = Array.from({ length: 8 }, (_, value) => value)
            .filter((value) => {
                const count = CATEGORY_ORDER.reduce((sum, _, index) => sum + ((value >> index) & 1), 0);
                return count === minimumExtrasPerPeriod || count === minimumExtrasPerPeriod + 1;
            });
        const patternCounts = Array(patterns.length).fill(0) as number[];

        function buildCandidate(): Record<SeasonalLearningCategory, number[]> {
            const periodPatterns = patterns
                .flatMap((pattern, index) => Array(patternCounts[index]).fill(pattern))
                .sort((left, right) => {
                    const leftCount = CATEGORY_ORDER.reduce((sum, _, index) => sum + ((left >> index) & 1), 0);
                    const rightCount = CATEGORY_ORDER.reduce((sum, _, index) => sum + ((right >> index) & 1), 0);
                    return rightCount - leftCount || left - right;
                });
            return Object.fromEntries(CATEGORY_ORDER.map((category, categoryIndex) => [
                category,
                periodPatterns.map((pattern) => bases[categoryIndex] + ((pattern >> categoryIndex) & 1))
            ])) as Record<SeasonalLearningCategory, number[]>;
        }

        function search(
            patternIndex: number,
            remainingPeriods: number,
            remainingExtras: number[]
        ): SeasonalLearningAllocationQuotas | null {
            if (patternIndex === patterns.length) {
                if (remainingPeriods !== 0 || remainingExtras.some((count) => count !== 0)) return null;
                const category = buildCandidate();
                try {
                    return {
                        category,
                        usLineLeader: buildUsLineLeaderQuotas(people, category, periodCount)
                    };
                } catch {
                    return null;
                }
            }

            const pattern = patterns[patternIndex];
            const bits = CATEGORY_ORDER.map((_, categoryIndex) => (pattern >> categoryIndex) & 1);
            let maximum = remainingPeriods;
            bits.forEach((bit, categoryIndex) => {
                if (bit) maximum = Math.min(maximum, remainingExtras[categoryIndex]);
            });
            for (let count = maximum; count >= 0; count -= 1) {
                const nextPeriods = remainingPeriods - count;
                const nextExtras = remainingExtras.map((value, categoryIndex) => value - bits[categoryIndex] * count);
                if (nextExtras.some((value) => value < 0 || value > nextPeriods)) continue;
                patternCounts[patternIndex] = count;
                const result = search(patternIndex + 1, nextPeriods, nextExtras);
                if (result) return result;
            }
            patternCounts[patternIndex] = 0;
            return null;
        }

        const result = search(0, periodCount, remainders);
        if (!result) throw new Error("无法同时均衡岗位人数和美线带队人员。");
        return result;
    }

    window.SeasonalLearningAllocation = { buildBalancedQuotas };
})();
