type MemoItem = readonly [name: string, path: string];

interface MemoSearchSource {
  name: string;
  path: string;
  markdown: string;
}

interface MemoSearchResult extends MemoSearchSource {
  snippet: string;
}

interface MemoSearchEngine {
  normalizeQuery(value: string): string;
  stripFrontmatter(markdown: string): string;
  markdownToText(markdown: string): string;
  search(sources: MemoSearchSource[], value: string): MemoSearchResult[];
}

interface Window {
  MEMO_ITEMS: MemoItem[];
  MemoSearch: MemoSearchEngine;
}
