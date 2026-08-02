import type { JobskillSearchResult, JobskillSearchSource } from "./models";

  export function normalizeQuery(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
  }

  export function stripFrontmatter(markdown: string): string {
    return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  }

  export function markdownToText(markdown: string): string {
    return stripFrontmatter(markdown)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^```.*$/gm, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/^\s*(?:#{1,6}|[-+*>]|\d+\.)\s+/gm, "")
      .replace(/^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/gm, " ")
      .replace(/[|`*_~]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function makeSnippet(text: string, query: string): string {
    const index = text.toLocaleLowerCase("zh-CN").indexOf(query);
    if (index < 0) return text.slice(0, 100);

    const start = Math.max(0, index - 35);
    const end = Math.min(text.length, index + query.length + 65);
    return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
  }

  export function search(sources: JobskillSearchSource[], value: string): JobskillSearchResult[] {
    const query = normalizeQuery(value);
    if (!query) return [];

    return sources.flatMap((source) => {
      const text = markdownToText(source.markdown);
      const searchable = `${source.name} ${text}`.toLocaleLowerCase("zh-CN");
      if (!searchable.includes(query)) return [];
      return [{ ...source, snippet: makeSnippet(text, query) }];
    });
  }
