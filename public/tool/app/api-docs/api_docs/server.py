from __future__ import annotations

import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from .catalog import ApiCatalog
from .executor import ApiExecutor


class ApiDocsServer(ThreadingHTTPServer):
    daemon_threads = True


def create_server(
    app_directory: Path,
    port: int = 0,
    executor: ApiExecutor | None = None,
) -> ApiDocsServer:
    app_directory = app_directory.resolve()
    catalog = executor.catalog if executor is not None else ApiCatalog(app_directory / "catalog")
    request_executor = executor or ApiExecutor(catalog)
    shared_static_root = app_directory.parents[2] if len(app_directory.parents) >= 3 else app_directory

    def shared_asset(relative_path: str) -> Path:
        packaged = app_directory / relative_path
        return packaged if packaged.is_file() else shared_static_root / relative_path

    class Handler(BaseHTTPRequestHandler):
        server_version = "WatchdogApiDocs/1.0"

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
            if content_type.startswith("text/") or path.suffix in {".js", ".mjs", ".css", ".json"}:
                content_type += "; charset=utf-8"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(content)

        def _static_path(self, request_path: str) -> Path | None:
            fixed = {
                "/": app_directory / "index.html",
                "/index.html": app_directory / "index.html",
                "/styles.css": app_directory / "styles.css",
                "/app.js": (app_directory / "app.js") if (app_directory / "app.js").is_file() else (app_directory / "app.mjs"),
                "/theme.js": shared_asset("theme.js"),
                "/theme.css": shared_asset("theme.css"),
            }
            if request_path in fixed:
                return fixed[request_path]
            if request_path.endswith(".mjs") and request_path.count("/") == 1:
                candidate = (app_directory / unquote(request_path.lstrip("/"))).resolve()
                try:
                    candidate.relative_to(app_directory)
                except ValueError:
                    return None
                return candidate
            if request_path.startswith("/catalog/"):
                candidate = (app_directory / unquote(request_path.lstrip("/"))).resolve()
                try:
                    candidate.relative_to(app_directory / "catalog")
                except ValueError:
                    return None
                return candidate
            return None

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path == "/api/health":
                self._send_json({"available": True, "session": request_executor.session_status()})
                return
            if path == "/api/catalog":
                self._send_json(catalog.as_dict())
                return
            if path == "/api/options/lock-types":
                try:
                    self._send_json({"options": request_executor.load_options("lock-types")})
                except Exception as error:
                    self._send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
                return
            static_path = self._static_path(path)
            if static_path is None:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            self._serve_file(static_path)

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            try:
                payload = self._read_json()
                if path == "/api/session":
                    result = request_executor.load_credentials(str(payload.get("credentials", "") or ""))
                elif path == "/api/execute":
                    parameters = payload.get("parameters", {})
                    if not isinstance(parameters, dict):
                        raise ValueError("接口参数必须是 JSON 对象")
                    result = request_executor.execute(
                        str(payload.get("endpointId", "") or ""),
                        parameters,
                    )
                else:
                    self._send_json({"error": "接口不存在"}, HTTPStatus.NOT_FOUND)
                    return
                self._send_json(result)
            except Exception as error:
                self._send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

        def do_DELETE(self) -> None:  # noqa: N802
            if urlparse(self.path).path != "/api/session":
                self._send_json({"error": "接口不存在"}, HTTPStatus.NOT_FOUND)
                return
            request_executor.clear_credentials()
            self._send_json(request_executor.session_status())

    server = ApiDocsServer(("127.0.0.1", port), Handler)
    server.executor = request_executor  # type: ignore[attr-defined]
    return server
