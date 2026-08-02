
    type LooseIndexItem = {
        originalStart: number;
        originalEnd: number;
        normalizedText: string;
    };

    function normalizeExact(value: unknown): string {
        return value === null || value === undefined ? "" : String(value);
    }

    function normalizeLooseChar(char: string): string {
        return char.normalize("NFKC").toLowerCase();
    }

    function isIgnoredLooseChar(char: string): boolean {
        return /[\s\p{P}\p{S}]/u.test(char);
    }

    function buildLooseIndex(value: unknown): { normalized: string; offsetMap: LooseIndexItem[] } {
        const source = normalizeExact(value);
        const chars = Array.from(source);
        const offsetMap: LooseIndexItem[] = [];
        let normalized = "";
        let originalOffset = 0;

        chars.forEach((char) => {
            const originalStart = originalOffset;
            const originalEnd = originalStart + char.length;
            originalOffset = originalEnd;

            const normalizedText = normalizeLooseChar(char);
            Array.from(normalizedText).forEach((normalizedChar) => {
                if (isIgnoredLooseChar(normalizedChar)) return;
                normalized += normalizedChar;
                offsetMap.push({
                    originalStart,
                    originalEnd,
                    normalizedText: normalizedChar
                });
            });
        });

        return { normalized, offsetMap };
    }

    function normalizeLoose(value: unknown): string {
        return buildLooseIndex(value).normalized;
    }

export const AuditKingTextNormalizer = {
        normalizeExact,
        normalizeLoose,
        buildLooseIndex
    };
