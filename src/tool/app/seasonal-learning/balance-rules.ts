(function () {
    const BalanceFilter = window.SeasonalLearningBalanceFilter;

    const HOOKS: SeasonalLearningBalanceHookDefinition[] = [
        {
            id: "us-line-leader",
            label: "美线带队",
            priority: 200,
            defaultEnabled: true,
            matches: (person) => person.isUsLineLeader
        },
        {
            id: "leader",
            label: "带队机长",
            priority: 100,
            defaultEnabled: true,
            matches: (person) => person.isLeader
        }
    ].sort((left, right) => right.priority - left.priority);

    const hookIds = new Set(HOOKS.map((hook) => hook.id));
    const DEFAULT_ENABLED_HOOK_IDS = HOOKS
        .filter((hook) => hook.defaultEnabled)
        .map((hook) => hook.id);

    function normalizeEnabledHookIds(enabledHookIds: readonly string[] = DEFAULT_ENABLED_HOOK_IDS): string[] {
        const enabled = new Set(enabledHookIds.filter((id) => hookIds.has(id)));
        return HOOKS.filter((hook) => enabled.has(hook.id)).map((hook) => hook.id);
    }

    function resolveBalanceGroup(
        person: SeasonalLearningPerson,
        enabledHookIds: readonly string[] = DEFAULT_ENABLED_HOOK_IDS
    ): SeasonalLearningBalanceGroupDefinition | null {
        if (BalanceFilter.shouldIgnoreOperational(person)) return null;
        const enabled = new Set(normalizeEnabledHookIds(enabledHookIds));
        const hook = HOOKS.find((candidate) => enabled.has(candidate.id) && candidate.matches(person));
        if (hook) {
            return {
                id: `hook:${hook.id}`,
                label: hook.label,
                kind: "hook",
                priority: hook.priority
            };
        }
        return {
            id: `technical:${person.technicalInfo}`,
            label: person.technicalInfo,
            kind: "technical",
            priority: 0
        };
    }

    window.SeasonalLearningBalanceRules = {
        HOOKS,
        DEFAULT_ENABLED_HOOK_IDS,
        normalizeEnabledHookIds,
        resolveBalanceGroup
    };
})();
