import type {
    RevisionDecision,
    RevisionDecisionMap,
    RevisionDecisionSummary,
    RevisionEvent
} from "./models";
    const valid = new Set<RevisionDecision>(["pending", "included", "excluded"]);

    function normalize(events: Array<Pick<RevisionEvent, "id">>, input: RevisionDecisionMap = {}): RevisionDecisionMap {
        const eventIds = new Set(events.map((event) => event.id));
        const output: RevisionDecisionMap = {};
        Object.entries(input || {}).forEach(([eventId, decision]) => {
            if (eventIds.has(eventId) && valid.has(decision)) output[eventId] = decision;
        });
        return output;
    }

    function get(state: RevisionDecisionMap, eventId: string): RevisionDecision {
        return valid.has(state?.[eventId]) ? state[eventId] : "pending";
    }

    function set(state: RevisionDecisionMap, eventId: string, decision: RevisionDecision): RevisionDecisionMap {
        if (!valid.has(decision)) throw new Error("修订事件处理状态无效。");
        const output = { ...(state || {}) };
        if (decision === "pending") delete output[eventId];
        else output[eventId] = decision;
        return output;
    }

    function setMany(state: RevisionDecisionMap, eventIds: string[], decision: RevisionDecision): RevisionDecisionMap {
        return eventIds.reduce((output, eventId) => set(output, eventId, decision), { ...(state || {}) });
    }

    function summarize(events: Array<Pick<RevisionEvent, "id">>, state: RevisionDecisionMap): RevisionDecisionSummary {
        return events.reduce((summary, event) => {
            summary[get(state, event.id)] += 1;
            return summary;
        }, { pending: 0, included: 0, excluded: 0 });
    }

    function eventsWith<T extends Pick<RevisionEvent, "id">>(events: T[], state: RevisionDecisionMap, decision: RevisionDecision): T[] {
        return events.filter((event) => get(state, event.id) === decision);
    }

    function label(decision: RevisionDecision): string {
        return { pending: "待处理", included: "纳入报告", excluded: "不纳入" }[decision];
    }

export const ManualProofDecisions = { normalize, get, set, setMany, summarize, eventsWith, label };
