export type MemoItem = readonly [name: string, path: string];

export interface MemoSearchSource {
  name: string;
  path: string;
  markdown: string;
}

export interface MemoSearchResult extends MemoSearchSource {
  snippet: string;
}
