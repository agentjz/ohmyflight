export type JobskillItem = readonly [name: string, path: string];

export interface JobskillSearchSource {
  name: string;
  path: string;
  markdown: string;
}

export interface JobskillSearchResult extends JobskillSearchSource {
  snippet: string;
}
