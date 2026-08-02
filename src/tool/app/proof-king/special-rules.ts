import type { ManualProofHookConfig } from "./models";

export const manualProofHooks: ManualProofHookConfig = {
        // 新增噪音时只追加完整的独立文本；不要填写模糊词或正常正文片段。
        ignoredNoisePhrases: ["310318 唐楚唯", "310319 王嘉璇", "217707 覃文添"]
        // 多个噪音示例：ignoredNoisePhrases: ["310318 唐楚唯", "310319 王嘉璇", "其他完整噪音文本"]
    };
