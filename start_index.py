from __future__ import annotations

import argparse
import http.server
import os
import socketserver
import subprocess
import sys
import webbrowser
from functools import partial
from pathlib import Path


PORT = 4567


class LocalThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def build_dist(project_root: Path) -> None:
    npm_command = "npm.cmd" if os.name == "nt" else "npm"
    print("[watchdog] Building dist and source archive...")
    subprocess.run([npm_command, "run", "build"], cwd=project_root, check=True)


def open_browser(url: str) -> None:
    print("[watchdog] Opening local site...")
    if os.name == "nt":
        try:
            subprocess.Popen(["cmd", "/c", "start", "", "msedge", "--inprivate", url])
            return
        except OSError:
            pass
    webbrowser.open(url)


def create_server(
    directory: Path,
    port: int,
) -> LocalThreadingTCPServer:
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    return LocalThreadingTCPServer(("127.0.0.1", port), handler)


def serve(directory: Path, port: int, should_open: bool) -> None:
    server = create_server(directory, port)
    with server:
        url = f"http://localhost:{port}/index.html"
        print(f"[watchdog] Serving {directory} at {url}")
        if should_open:
            open_browser(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n[watchdog] Server stopped.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build and serve watchdog locally.")
    parser.add_argument("--port", type=int, default=PORT, help="Local HTTP port.")
    parser.add_argument("--no-build", action="store_true", help="Skip npm build.")
    parser.add_argument("--no-open", action="store_true", help="Do not open browser.")
    parser.add_argument("--check", action="store_true", help="Validate paths and exit.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_root = Path(__file__).resolve().parent
    dist_dir = project_root / "dist"

    if args.check:
        if not (project_root / "package.json").exists():
            print("[watchdog] package.json not found.", file=sys.stderr)
            return 1
        print("[watchdog] start_index.py check passed.")
        return 0

    try:
        if not args.no_build:
            build_dist(project_root)
        if not dist_dir.exists():
            print("[watchdog] dist directory not found. Run without --no-build first.", file=sys.stderr)
            return 1
        serve(dist_dir, args.port, should_open=not args.no_open)
        return 0
    except subprocess.CalledProcessError as error:
        print(f"[watchdog] Build failed: {error}", file=sys.stderr)
        return error.returncode or 1
    except OSError as error:
        print(f"[watchdog] Failed to start server: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
