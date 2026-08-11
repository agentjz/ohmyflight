import "./support-shell";
import { initializeDocumentLibrary } from "./document-library";

initializeDocumentLibrary({
    dataUrl: "./manuals-data.json",
    loadErrorLabel: "用户手册加载失败",
    invalidDataMessage: "用户手册数据格式无效。",
    emptyMessage: "暂无用户手册。",
    downloadFileName: "cargodog-用户手册.md",
    itemIdPrefix: "manualSource"
});
