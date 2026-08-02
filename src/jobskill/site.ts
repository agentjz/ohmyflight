import "../tool/support-shell";
import type { JobskillItem, JobskillSearchResult } from "./models";
import * as searchEngine from "./search";
import { jobskillItems as items } from "./skills-data";

  const list = requireElement("skillList", HTMLElement);
  const content = requireElement("content", HTMLElement);
  const sidebarMenu = requireElement("sidebarMenu", HTMLElement);
  const searchInput = requireElement("skillSearch", HTMLInputElement);
  const searchStatus = requireElement("searchStatus", HTMLElement);
  const markdownCache = new Map<string, Promise<string>>();
  let renderVersion = 0;
  let searchVersion = 0;
  let searchTimer: number | undefined;

  function requireElement<T extends HTMLElement>(id: string, Type: { new(): T }): T {
    const element = document.getElementById(id);
    if (!(element instanceof Type)) throw new Error(`页面缺少必要元素：${id}`);
    return element;
  }

  function hashName(): string {
    try {
      return decodeURIComponent(location.hash.replace(/^#/, ""));
    } catch {
      return "";
    }
  }

  function findItem(name?: string): JobskillItem | undefined {
    return items.find(([itemName]) => itemName === name) || items[0];
  }

  function basePath(path: string): string {
    return path.slice(0, path.lastIndexOf("/") + 1);
  }

  function fetchMarkdown(item: JobskillItem): Promise<string> {
    const [, path] = item;
    const cached = markdownCache.get(path);
    if (cached) return cached;

    const request = fetch(encodeURI(path)).then((response) => {
      if (!response.ok) throw new Error(`加载失败：${response.status}`);
      return response.text();
    });
    markdownCache.set(path, request);
    request.catch(() => markdownCache.delete(path));
    return request;
  }

  function fixImages(html: string, base: string): string {
    const template = document.createElement("template");
    template.innerHTML = html;
    template.content.querySelectorAll<HTMLImageElement>("img[src]").forEach((image) => {
      const src = image.getAttribute("src") || "";
      if (/^(https?:)?\/\//.test(src) || src.startsWith("/") || src.startsWith("data:")) return;
      image.setAttribute("src", base + src.replace(/^\.\//, ""));
    });
    return template.innerHTML;
  }

  function wrapTables(): void {
    content.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
      if (table.parentElement?.classList.contains("table-wrap")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "table-wrap";
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function highlightContent(value: string): void {
    const query = searchEngine.normalizeQuery(value);
    if (!query) return;

    const nodes: Text[] = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("mark, script, style")) return NodeFilter.FILTER_REJECT;
        return node.nodeValue?.toLocaleLowerCase("zh-CN").includes(query)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);

    nodes.forEach((node) => {
      const source = node.nodeValue || "";
      const lowerSource = source.toLocaleLowerCase("zh-CN");
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      let matchIndex = lowerSource.indexOf(query);

      while (matchIndex >= 0) {
        fragment.append(source.slice(cursor, matchIndex));
        const mark = document.createElement("mark");
        mark.className = "search-highlight";
        mark.textContent = source.slice(matchIndex, matchIndex + query.length);
        fragment.append(mark);
        cursor = matchIndex + query.length;
        matchIndex = lowerSource.indexOf(query, cursor);
      }
      fragment.append(source.slice(cursor));
      node.replaceWith(fragment);
    });

    content.querySelector<HTMLElement>(".search-highlight")?.scrollIntoView({ block: "center" });
  }

  function createNavLink(name: string, snippet?: string): HTMLAnchorElement {
    const link = document.createElement("a");
    link.href = `#${encodeURIComponent(name)}`;
    link.className = `nav-link${snippet ? " search-result" : ""}`;
    link.dataset.skillName = name;

    const title = document.createElement("span");
    title.className = snippet ? "search-result-name" : "";
    title.textContent = name;
    link.appendChild(title);

    if (snippet) {
      const summary = document.createElement("span");
      summary.className = "search-result-snippet";
      summary.textContent = snippet;
      link.appendChild(summary);
    }
    return link;
  }

  function renderFullList(): void {
    list.replaceChildren(...items.map(([name]) => createNavLink(name)));
    markActive(hashName() || items[0]?.[0] || "");
  }

  function renderSearchResults(results: JobskillSearchResult[]): void {
    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "没有找到相关内容";
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...results.map((result) => createNavLink(result.name, result.snippet)));
    markActive(hashName());
  }

  function markActive(name: string): void {
    list.querySelectorAll<HTMLElement>("[data-skill-name]").forEach((link) => {
      link.classList.toggle("active", link.dataset.skillName === name);
    });
  }

  function closeMobileMenu(): void {
    if (window.innerWidth >= 768 || typeof bootstrap === "undefined") return;
    bootstrap.Collapse.getOrCreateInstance(sidebarMenu, { toggle: false }).hide();
  }

  async function loadSkill(name?: string, value = searchInput.value): Promise<void> {
    const item = findItem(name || hashName());
    if (!item) {
      content.textContent = "没有 Skill。";
      return;
    }

    const version = ++renderVersion;
    document.title = `${item[0]} - 工作技能`;
    markActive(item[0]);
    content.textContent = "正在加载...";

    try {
      const markdown = await fetchMarkdown(item);
      if (version !== renderVersion) return;
      content.innerHTML = fixImages(marked.parse(searchEngine.stripFrontmatter(markdown)), basePath(item[1]));
      wrapTables();
      highlightContent(value);
    } catch (error) {
      if (version !== renderVersion) return;
      content.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  function selectSkill(name: string): void {
    const nextHash = `#${encodeURIComponent(name)}`;
    if (location.hash === nextHash) {
      loadSkill(name);
    } else {
      location.hash = nextHash;
    }
    closeMobileMenu();
  }

  async function runSearch(value: string, version: number): Promise<void> {
    try {
      const sources = await Promise.all(items.map(async ([name, path]) => ({
        name,
        path,
        markdown: await fetchMarkdown([name, path])
      })));
      if (version !== searchVersion) return;

      const results = searchEngine.search(sources, value);
      renderSearchResults(results);
      searchStatus.textContent = results.length ? `${results.length} 个 Skill 命中` : "没有命中";
      if (!results.length) return;

      const currentName = hashName();
      const selected = results.find((result) => result.name === currentName) || results[0];
      if (selected.name !== currentName) {
        history.replaceState(null, "", `#${encodeURIComponent(selected.name)}`);
      }
      await loadSkill(selected.name, value);
    } catch (error) {
      if (version !== searchVersion) return;
      searchStatus.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  function handleSearchInput(): void {
    const value = searchInput.value;
    const query = searchEngine.normalizeQuery(value);
    const version = ++searchVersion;
    if (searchTimer !== undefined) window.clearTimeout(searchTimer);

    if (!query) {
      searchStatus.textContent = "";
      renderFullList();
      loadSkill(hashName(), "");
      return;
    }

    searchStatus.textContent = "正在搜索...";
    searchTimer = window.setTimeout(() => runSearch(value, version), 120);
  }

  list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLElement>("[data-skill-name]");
    const name = link?.dataset.skillName;
    if (!name) return;
    event.preventDefault();
    selectSkill(name);
  });
  searchInput.addEventListener("input", handleSearchInput);
  window.addEventListener("hashchange", () => loadSkill());

  renderFullList();
  loadSkill();
