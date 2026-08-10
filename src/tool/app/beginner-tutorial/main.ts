import "../../support-shell";
import { initializeDocumentLibrary } from "../../document-library";

initializeDocumentLibrary({
    dataUrl: "../../beginner-tutorial-data.json",
    loadErrorLabel: "菜鸟教程加载失败",
    invalidDataMessage: "菜鸟教程数据格式无效。",
    emptyMessage: "暂无教程。",
    downloadFileName: "ohmyflight-菜鸟教程.md",
    itemIdPrefix: "tutorialSource"
});
