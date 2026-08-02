export type TextJoinerResult = {
    items: string[];
    text: string;
};

const TEXT_JOINER_INPUT_SEPARATOR = /[\s\p{P}\p{S}]+/gu;

export function splitItems(input: string): string[] {
    return input
        .split(TEXT_JOINER_INPUT_SEPARATOR)
        .filter((item) => item.length > 0);
}

export function join(input: string, separator = ""): TextJoinerResult {
    const items = splitItems(input);
    return {
        items,
        text: items.join(separator)
    };
}
