export function createProjectArchive(JSZip: any) {
    type ProjectEntryData = string | Blob | ArrayBuffer | Uint8Array;
    type ProjectEntryInput = {
        path: string;
        data: ProjectEntryData;
        role: string;
        mediaType?: string;
        originalName?: string;
    };
    type ProjectFileManifest = {
        path: string;
        role: string;
        mediaType: string;
        originalName: string;
        size: number;
        sha256: string;
    };
    type ProjectManifest = {
        format: "watchdog-project";
        tool: string;
        schemaVersion: number;
        exportedAt: string;
        metadata: Record<string, unknown>;
        files: ProjectFileManifest[];
    };
    type BuildOptions = {
        tool: string;
        schemaVersion: number;
        metadata?: Record<string, unknown>;
        entries: ProjectEntryInput[];
        onProgress?: (message: string, completed: number, total: number) => void;
    };

    const manifestPath = "project.json";

    async function build(options: BuildOptions): Promise<Uint8Array> {
        if (!String(options.tool || "").trim()) throw new Error("项目包缺少工具类型。");
        if (!Number.isInteger(options.schemaVersion) || options.schemaVersion < 1) throw new Error("项目包版本无效。");
        if (!Array.isArray(options.entries) || !options.entries.length) throw new Error("项目包没有可保存内容。");
        const zip = new JSZip();
        const seen = new Set<string>();
        const files: ProjectFileManifest[] = [];
        for (let index = 0; index < options.entries.length; index += 1) {
            const entry = options.entries[index];
            const path = normalizePath(entry.path);
            if (path === manifestPath || seen.has(path)) throw new Error(`项目包文件路径重复：${path}`);
            seen.add(path);
            options.onProgress?.(`正在整理 ${entry.originalName || path}`, index, options.entries.length);
            const bytes = await toBytes(entry.data);
            zip.file(path, bytes);
            files.push({
                path,
                role: String(entry.role || "data"),
                mediaType: entry.mediaType || mediaTypeOf(entry.data),
                originalName: entry.originalName || (entry.data instanceof File ? entry.data.name : path.split("/").at(-1) || path),
                size: bytes.byteLength,
                sha256: await sha256(bytes)
            });
        }
        const manifest: ProjectManifest = {
            format: "watchdog-project",
            tool: options.tool,
            schemaVersion: options.schemaVersion,
            exportedAt: new Date().toISOString(),
            metadata: options.metadata || {},
            files
        };
        zip.file(manifestPath, JSON.stringify(manifest, null, 2));
        options.onProgress?.("正在压缩项目文件", options.entries.length, options.entries.length);
        return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    }

    async function read(input: Blob | ArrayBuffer | Uint8Array, expectedTool: string, expectedSchemaVersion: number): Promise<{
        manifest: ProjectManifest;
        bytes(path: string): Promise<Uint8Array>;
        text(path: string): Promise<string>;
        json(path: string): Promise<any>;
        file(path: string, name?: string, mediaType?: string): Promise<File>;
    }> {
        const zip = await JSZip.loadAsync(await toBytes(input));
        const manifestEntry = zip.file(manifestPath);
        if (!manifestEntry) throw new Error("项目包缺少 project.json。");
        let manifest: ProjectManifest;
        try {
            manifest = JSON.parse(await manifestEntry.async("text")) as ProjectManifest;
        } catch (_error) {
            throw new Error("项目包清单不是有效 JSON。");
        }
        if (manifest?.format !== "watchdog-project") throw new Error("不是 watchdog 项目包。");
        if (manifest.tool !== expectedTool) throw new Error(`项目类型不匹配：需要 ${expectedTool}，实际为 ${manifest.tool || "未知"}。`);
        if (manifest.schemaVersion !== expectedSchemaVersion) {
            throw new Error(`项目包版本不支持：需要 ${expectedSchemaVersion}，实际为 ${manifest.schemaVersion || "未知"}。`);
        }
        if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error("项目包清单没有文件记录。");
        const cache = new Map<string, Uint8Array>();
        for (const item of manifest.files) {
            const path = normalizePath(item.path);
            const entry = zip.file(path);
            if (!entry) throw new Error(`项目包缺少文件：${path}`);
            const data = await entry.async("uint8array");
            if (data.byteLength !== Number(item.size) || await sha256(data) !== item.sha256) {
                throw new Error(`项目文件校验失败：${path}`);
            }
            cache.set(path, data);
        }
        const getBytes = async (pathValue: string): Promise<Uint8Array> => {
            const path = normalizePath(pathValue);
            const value = cache.get(path);
            if (!value) throw new Error(`项目包未声明文件：${path}`);
            return value.slice();
        };
        return {
            manifest,
            bytes: getBytes,
            text: async (path) => new TextDecoder().decode(await getBytes(path)),
            json: async (path) => {
                try {
                    return JSON.parse(new TextDecoder().decode(await getBytes(path)));
                } catch (_error) {
                    throw new Error(`项目状态不是有效 JSON：${normalizePath(path)}`);
                }
            },
            file: async (path, name, mediaType) => {
                const normalizedPath = normalizePath(path);
                const metadata = manifest.files.find((item) => item.path === normalizedPath);
                const data = await getBytes(normalizedPath);
                return new File([toArrayBuffer(data)], name || metadata?.originalName || normalizedPath.split("/").at(-1) || "file", {
                    type: mediaType || metadata?.mediaType || "application/octet-stream"
                });
            }
        };
    }

    function normalizePath(value: string): string {
        const path = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
        const parts = path.split("/");
        if (!path || parts.some((part) => !part || part === "." || part === "..")) throw new Error(`项目包路径无效：${value}`);
        return path;
    }

    function safeFileName(value: string): string {
        const cleaned = String(value || "file").replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_").trim();
        return cleaned || "file";
    }

    async function toBytes(value: ProjectEntryData | Blob): Promise<Uint8Array> {
        if (typeof value === "string") return new TextEncoder().encode(value);
        if (value instanceof Uint8Array) return value.slice();
        if (ArrayBuffer.isView(value)) {
            const view = value as ArrayBufferView;
            return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
        }
        if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
        if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
        throw new Error("项目包包含不支持的数据类型。");
    }

    function mediaTypeOf(value: ProjectEntryData): string {
        return value instanceof Blob && value.type ? value.type : "application/octet-stream";
    }

    async function sha256(bytes: Uint8Array): Promise<string> {
        const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
        return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
    }

    function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
        const output = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(output).set(bytes);
        return output;
    }

    function download(bytes: Uint8Array | Blob, filename: string, mediaType = "application/zip"): void {
        const blob = bytes instanceof Blob ? bytes : new Blob([toArrayBuffer(bytes)], { type: mediaType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

return {
    build,
    read,
    safeFileName,
    sha256,
    download,
    toArrayBuffer
};
}
