import { ManualProofAlignment } from "./alignment-core";
import type {
    ComparisonProgress,
    ComparisonWorkerFailure,
    ComparisonWorkerProgress,
    ComparisonWorkerRequest,
    ComparisonWorkerSuccess
} from "./models";

self.addEventListener("message", (event: MessageEvent<ComparisonWorkerRequest>) => {
    const request = event.data;
    if (!request || request.type !== "compare") return;
    try {
        const comparison = ManualProofAlignment.compare(
            request.myManual,
            request.referenceManual,
            request.options || {},
            (progress: ComparisonProgress) => {
                self.postMessage({ type: "progress", requestId: request.requestId, progress } as ComparisonWorkerProgress);
            }
        );
        self.postMessage({ type: "success", requestId: request.requestId, comparison } as ComparisonWorkerSuccess);
    } catch (error) {
        self.postMessage({
            type: "failure",
            requestId: request.requestId,
            message: error instanceof Error ? error.message : String(error)
        } as ComparisonWorkerFailure);
    }
});
