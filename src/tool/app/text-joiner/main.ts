import { join } from "./logic";

function requireTextJoinerElement<T extends HTMLElement>(id: string, Type: { new(): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof Type)) throw new Error(`页面缺少必要元素：${id}`);
    return element;
}

const inputText = requireTextJoinerElement("inputText", HTMLTextAreaElement);
const outputSeparator = requireTextJoinerElement("outputSeparator", HTMLInputElement);
const outputText = requireTextJoinerElement("outputText", HTMLTextAreaElement);
const resultStatus = requireTextJoinerElement("resultStatus", HTMLElement);
const joinButton = requireTextJoinerElement("joinButton", HTMLButtonElement);
const clearButton = requireTextJoinerElement("clearButton", HTMLButtonElement);
const copyButton = requireTextJoinerElement("copyButton", HTMLButtonElement);

function renderJoinedText(): void {
    const result = join(inputText.value, outputSeparator.value);
    outputText.value = result.text;
    resultStatus.textContent = `${result.items.length} 项`;
    copyButton.disabled = result.text.length === 0;
}

function clearTextJoiner(): void {
    inputText.value = "";
    outputSeparator.value = "";
    renderJoinedText();
    inputText.focus();
}

async function copyJoinedText(): Promise<void> {
    if (!outputText.value) return;

    try {
        await navigator.clipboard.writeText(outputText.value);
    } catch {
        outputText.focus();
        outputText.select();
        if (!document.execCommand("copy")) {
            resultStatus.textContent = "复制失败，请手动复制";
            return;
        }
    }

    copyButton.textContent = "已复制";
    window.setTimeout(() => {
        copyButton.textContent = "复制";
    }, 1200);
}

inputText.addEventListener("input", renderJoinedText);
outputSeparator.addEventListener("input", renderJoinedText);
joinButton.addEventListener("click", renderJoinedText);
clearButton.addEventListener("click", clearTextJoiner);
copyButton.addEventListener("click", () => void copyJoinedText());
