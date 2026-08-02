import type { AuditKingFolderScriptConfig } from "./models";

    interface FolderRangeEndpoint {
        major: string;
        minor: number;
        minorWidth: number;
        minorText: string;
    }

    function normalizeConfig(config: AuditKingFolderScriptConfig): AuditKingFolderScriptConfig {
        return {
            rangeText: String(config.rangeText || "").trim()
        };
    }

    function parseEndpoint(value: string): FolderRangeEndpoint | null {
        const match = value.trim().match(/^(\d+)\.(\d+)$/);
        if (!match) return null;
        return {
            major: match[1],
            minor: Number(match[2]),
            minorWidth: match[2].length,
            minorText: match[2]
        };
    }

    function parseRange(rangeText: string): { start: FolderRangeEndpoint; end: FolderRangeEndpoint; width: number } {
        const parts = rangeText.split("-");
        if (parts.length !== 2) {
            throw new Error("范围格式应为 X.X-X.X，例如 1.1-1.61。");
        }
        const start = parseEndpoint(parts[0]);
        const end = parseEndpoint(parts[1]);
        if (!start || !end) {
            throw new Error("范围格式应为 X.X-X.X，例如 1.1-1.61。");
        }
        if (start.major !== end.major) {
            throw new Error("当前只支持同一一级编号内生成文件夹。");
        }
        if (end.minor < start.minor) {
            throw new Error("结束编号不能小于起始编号。");
        }
        const shouldPreservePadding = /^0\d+/.test(start.minorText) || /^0\d+/.test(end.minorText);
        return {
            start,
            end,
            width: shouldPreservePadding ? Math.max(start.minorWidth, end.minorWidth) : 0
        };
    }

    function formatEndpoint(major: string, minor: number, width: number): string {
        return `${major}.${width > 0 ? String(minor).padStart(width, "0") : String(minor)}`;
    }

    function buildFolderRanges(rawConfig: AuditKingFolderScriptConfig): string[] {
        const config = normalizeConfig(rawConfig);
        const range = parseRange(config.rangeText);
        const folders: string[] = [];
        for (let current = range.start.minor; current <= range.end.minor; current += 1) {
            const endpoint = formatEndpoint(range.start.major, current, range.width);
            folders.push(endpoint);
        }
        return folders;
    }

    function buildFolderCreatorPython(config: AuditKingFolderScriptConfig): string {
        const folders = buildFolderRanges(config);
        const folderList = JSON.stringify(folders, null, 4)
            .replace(/^\[/, "[")
            .replace(/\]$/, "]");

        return [
            "# -*- coding: utf-8 -*-",
            "\"\"\"在当前目录创建审计空文件夹。\"\"\"",
            "",
            "from pathlib import Path",
            "",
            `FOLDERS = ${folderList}`,
            "",
            "",
            "def main():",
            "    root = Path.cwd()",
            "    created = 0",
            "    existed = 0",
            "    failed = []",
            "",
            "    for name in FOLDERS:",
            "        target = root / name",
            "        try:",
            "            if target.exists():",
            "                existed += 1",
            "            else:",
            "                target.mkdir(exist_ok=True)",
            "                created += 1",
            "        except Exception as error:",
            "            failed.append((name, str(error)))",
            "",
            "    print(f\"目标目录：{root}\")",
            "    print(f\"新建：{created} 个，已存在：{existed} 个，失败：{len(failed)} 个\")",
            "    for name, message in failed:",
            "        print(f\"失败：{name} -> {message}\")",
            "",
            "",
            "if __name__ == \"__main__\":",
            "    main()",
            ""
        ].join("\n");
    }

export const AuditKingFolderScriptGenerator = {
        buildFolderRanges,
        buildFolderCreatorPython
    };
