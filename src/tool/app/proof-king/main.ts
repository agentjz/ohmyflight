import { manualProofHooks } from "./special-rules";
import { createWorkspace } from "./workspace";

const browserWindow = window as typeof window & {
    mammoth?: { extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value?: string }> };
    pdfjsLib?: any;
    XLSX: typeof import("xlsx-js-style");
    docx?: any;
    JSZip?: any;
};
const workspace = createWorkspace({
    mammoth: browserWindow.mammoth || null,
    pdfjsLib: browserWindow.pdfjsLib || null,
    xlsx: browserWindow.XLSX,
    docx: browserWindow.docx || null,
    JSZip: browserWindow.JSZip || null,
    hooks: manualProofHooks
});

    const start = (): void => workspace.bind();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
