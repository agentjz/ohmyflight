import { execFileSync } from "node:child_process";

export function assertJavaScriptSyntax(filePath: string, _preferredMode = "auto"): void {
  execFileSync("node", ["--check", filePath], {
    stdio: "pipe"
  });
}

export function assertPythonSyntax(filePaths: string[]): void {
  if (!filePaths.length) return;

  const script = [
    "import ast, sys, tokenize",
    "for path in sys.argv[1:]:",
    "    with tokenize.open(path) as fh:",
    "        source = fh.read()",
    "    ast.parse(source, filename=path)"
  ].join("\n");

  execFileSync("python", ["-c", script, ...filePaths], {
    stdio: "pipe"
  });
}
