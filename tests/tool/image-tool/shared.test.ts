import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as shared from "../../../src/tool/app/image-tool/shared";

describe("图片工具 Object URL 生命周期", () => {
  let created: string[];
  let revoked: string[];

  beforeEach(() => {
    created = [];
    revoked = [];
    const urlApi = {
      createObjectURL() {
        const value = `blob:${created.length + 1}`;
        created.push(value);
        return value;
      },
      revokeObjectURL(value: string) {
        revoked.push(value);
      }
    };
    vi.stubGlobal("URL", urlApi);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("删除或清空上传项时释放对应 URL", () => {
    const items = [
      { file: {} as File, url: "blob:a" },
      { file: {} as File, url: "blob:b" }
    ];

    shared.removeImageItem(items, 0);
    expect(revoked).toEqual(["blob:a"]);
    shared.clearImageItems(items);
    expect(revoked).toEqual(["blob:a", "blob:b"]);
    expect(items).toEqual([]);
  });

  it("替换预览时先释放旧 URL", () => {
    const element = {
      dataset: {} as Record<string, string>,
      src: "",
      removeAttribute(name: string) {
        if (name === "src") this.src = "";
      }
    };

    shared.setObjectUrl(element as unknown as HTMLImageElement, {} as Blob);
    shared.setObjectUrl(element as unknown as HTMLImageElement, {} as Blob);
    shared.setObjectUrl(element as unknown as HTMLImageElement, null);

    expect(created).toEqual(["blob:1", "blob:2"]);
    expect(revoked).toEqual(["blob:1", "blob:2"]);
    expect(element.src).toBe("");
  });
});
