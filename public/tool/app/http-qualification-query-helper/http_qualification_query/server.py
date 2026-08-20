from __future__ import annotations

import base64
import binascii
import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlparse

from .manager import RunManager
from .models import InputPayload


def payload_from_json(payload: dict[str, object]) -> InputPayload:
    encoded = str(payload.get("excelBase64", "") or "")
    try:
        excel_bytes = base64.b64decode(encoded, validate=True) if encoded else None
    except (ValueError, binascii.Error) as error:
        raise ValueError("Excel 文件内容不是有效 Base64") from error
    return InputPayload(
        input_mode=str(payload.get("inputMode", "excel") or "excel"),
        excel_name=str(payload.get("excelName", "") or ""),
        excel_bytes=excel_bytes,
        pasted_text=str(payload.get("pastedText", "") or ""),
    )


class WorkbenchServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def create_server(
    app_directory: Path,
    port: int = 0,
    manager: RunManager | None = None,
) -> WorkbenchServer:
    app_directory = app_directory.resolve()
    run_manager = manager or RunManager(app_directory)
    web_root = app_directory / "web"
    shared_static_root = app_directory.parents[2]

    def workbench_asset(relative_path: str, shared_path: str) -> Path:
        packaged_path = web_root / relative_path
        return packaged_path if packaged_path.is_file() else shared_static_root / shared_path

    class Handler(BaseHTTPRequestHandler):
        server_version = "HttpQualificationQuery/1.0"

        def log_message(self, _format: str, *_args: object) -> None:
            return

        def _send_json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
            content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(content)

        def _read_json(self) -> dict[str, object]:
            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise ValueError("请求内容不是有效 JSON") from error
            if not isinstance(payload, dict):
                raise ValueError("请求内容必须是 JSON 对象")
            return payload

        def _serve_file(self, path: Path) -> None:
            if not path.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            content = path.read_bytes()
            content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            if content_type.startswith("text/") or path.suffix in {".mjs", ".js", ".css"}:
                content_type += "; charset=utf-8"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(content)

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path == "/api/status":
                self._send_json(run_manager.snapshot())
                return
            if path.startswith("/api/download/"):
                kind = path.rsplit("/", 1)[-1]
                result_path = run_manager.download_path(kind)
                if result_path is None:
                    self.send_error(HTTPStatus.NOT_FOUND)
                    return
                content = result_path.read_bytes()
                content_type = {
                    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    ".json": "application/json; charset=utf-8",
                }.get(result_path.suffix.lower(), "text/plain; charset=utf-8")
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(result_path.name)}")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            static_map = {
                "/": web_root / "index.html",
                "/index.html": web_root / "index.html",
                "/app.mjs": web_root / "app.mjs",
                "/styles.css": web_root / "styles.css",
                "/theme.js": workbench_asset("theme.js", "theme.js"),
                "/theme.css": workbench_asset("theme.css", "theme.css"),
                "/libs/bootstrap.min.css": workbench_asset("libs/bootstrap.min.css", "libs/bootstrap.min.css"),
            }
            static_path = static_map.get(path)
            if static_path is None:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            self._serve_file(static_path)

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            try:
                payload = self._read_json()
                if path == "/api/session/verify":
                    state = run_manager.verify_credentials(str(payload.get("credentials", "") or ""))
                elif path == "/api/check-data":
                    state = run_manager.check_data(payload_from_json(payload))
                elif path == "/api/run":
                    state = run_manager.run(payload_from_json(payload))
                elif path == "/api/stop":
                    state = run_manager.stop()
                elif path == "/api/start":
                    state = run_manager.start(
                        str(payload.get("credentials", "") or ""),
                        payload_from_json(payload),
                    )
                else:
                    self._send_json({"error": "接口不存在"}, HTTPStatus.NOT_FOUND)
                    return
                self._send_json(state)
            except Exception as error:
                self._send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    server = WorkbenchServer(("127.0.0.1", port), Handler)
    server.run_manager = run_manager  # type: ignore[attr-defined]
    return server
