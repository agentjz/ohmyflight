import { describe, expect, it } from "vitest";

import { ManualProofDecisions as decisions } from "../../../src/tool/app/proof-king/decision-model";

describe("校对之王人工决定", () => {
    it("区分待处理、纳入报告和不纳入并支持批量更新", () => {
        const events = [{ id: "revision-1" }, { id: "revision-2" }, { id: "revision-3" }];
        let state = decisions.normalize(events, { "revision-2": "included", missing: "excluded" });
        state = decisions.setMany(state, ["revision-1"], "excluded");

        expect(decisions.summarize(events, state)).toEqual({ pending: 1, included: 1, excluded: 1 });
        expect(decisions.eventsWith(events, state, "included").map((event: any) => event.id)).toEqual(["revision-2"]);
        expect(state).not.toHaveProperty("missing");
    });
});
