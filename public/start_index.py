from __future__ import annotations

import argparse
import http.server
import os
import socketserver
import subprocess
import webbrowser
from functools import partial
from pathlib import Path


PORT = 4567


def open_browser(url: str) -> None:
    if os.name == "nt":
        try:
            subprocess.Popen(["cmd", "/c", "start", "", "msedge", "--inprivate", url])
            return
        except OSError:
            pass
    webbrowser.open(url)


def serve(directory: Path, port: int) -> None:
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    with socketserver.TCPServer(("", port), handler) as server:
        print(f"[cargodog] Serving {directory} at http://localhost:{port}/")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n[cargodog] Server stopped.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve public cargodog files locally.")
    parser.add_argument("--port", type=int, default=PORT, help="Local HTTP port.")
    parser.add_argument("--no-open", action="store_true", help="Do not open browser.")
    parser.add_argument("--check", action="store_true", help="Validate paths and exit.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    public_root = Path(__file__).resolve().parent
    if args.check:
        if not (public_root / "index.html").exists():
            print("[cargodog] index.html not found.")
            return 1
        print("[cargodog] public/start_index.py check passed.")
        return 0

    if not args.no_open:
        open_browser(f"http://localhost:{args.port}/index.html")
    serve(public_root, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
