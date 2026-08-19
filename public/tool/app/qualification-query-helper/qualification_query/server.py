from __future__ import annotations

import base64
import binascii
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

from .manager import RunManager


class LocalHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def _public_asset(app_directory: Path, filename: str) -> Path:
    packaged = app_directory / "web" / filename
    if packaged.is_file():
        return packaged
    return app_directory.parents[2] / filename


def create_server(app_directory: Path, port: int = 0, manager: RunManager | None = None) -> LocalHTTPServer:
    app_directory = app_directory.resolve()
    run_manager = manager or RunManager(app_directory)
    web_directory = app_directory / "web"
    static_files = {
        "/": web_directory / "index.html",
        "/index.html": web_directory / "index.html",
        "/app.mjs": web_directory / "app.mjs",
        "/styles.css": web_directory / "styles.css",
        "/theme.css": _public_asset(app_directory, "theme.css"),
        "/theme.js": _public_asset(app_directory, "theme.js"),
        "/libs/bootstrap.min.css": _public_asset(app_directory, "libs/bootstrap.min.css"),
    }

    class Handler(BaseHTTPRequestHandler):
        def _json(self, payload: dict[str, Any], status: int = HTTPStatus.OK) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _file(self, path: Path, download: bool = False) -> None:
            if not path.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            content_types = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "text/javascript; charset=utf-8",
                ".mjs": "text/javascript; charset=utf-8",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".txt": "text/plain; charset=utf-8",
            }
            data = path.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_types.get(path.suffix.lower(), "application/octet-stream"))
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            if download:
                self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(path.name)}")
            self.end_headers()
            self.wfile.write(data)

        def _read_payload(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("请求内容必须是 JSON 对象")
            return payload

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path == "/api/status":
                self._json(run_manager.snapshot())
                return
            if path.startswith("/api/download/"):
                kind = path.rsplit("/", 1)[-1]
                result_path = run_manager.download_path(kind)
                if result_path is None:
                    self.send_error(HTTPStatus.NOT_FOUND)
                else:
                    self._file(result_path, download=True)
                return
            static_path = static_files.get(path)
            if static_path is None:
                self.send_error(HTTPStatus.NOT_FOUND)
            else:
                self._file(static_path)

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            try:
                payload = self._read_payload()
                if path in {"/api/prepare", "/api/start"}:
                    encoded = str(payload.get("excelBase64", "") or "")
                    try:
                        excel_bytes = base64.b64decode(encoded, validate=True) if encoded else None
                    except (ValueError, binascii.Error) as error:
                        raise ValueError("Excel 文件内容不是有效 Base64") from error
                    launch = run_manager.start if path == "/api/start" else run_manager.prepare
                    state = launch(
                        credentials=str(payload.get("credentials", "") or ""),
                        input_mode=str(payload.get("inputMode", "") or ""),
                        pasted_text=str(payload.get("pastedText", "") or ""),
                        excel_name=str(payload.get("excelName", "") or ""),
                        excel_bytes=excel_bytes,
                    )
                    self._json(state, HTTPStatus.ACCEPTED)
                    return
                if path == "/api/check-data":
                    self._json(run_manager.check_data(), HTTPStatus.ACCEPTED)
                    return
                if path == "/api/run":
                    self._json(run_manager.run(), HTTPStatus.ACCEPTED)
                    return
                if path == "/api/stop":
                    self._json(run_manager.stop())
                    return
                self.send_error(HTTPStatus.NOT_FOUND)
            except (ValueError, RuntimeError, json.JSONDecodeError, UnicodeDecodeError) as error:
                self._json({"error": str(error)}, HTTPStatus.CONFLICT)

        def log_message(self, _format: str, *_args: Any) -> None:
            return

    server = LocalHTTPServer(("127.0.0.1", port), Handler)
    server.run_manager = run_manager  # type: ignore[attr-defined]
    return server
