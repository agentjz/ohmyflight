"""Loopback HTTP server and staged run manager for lock entry."""

from __future__ import annotations

import base64
import copy
import json
import multiprocessing
import os
import queue
import signal
import subprocess
import threading
import uuid
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote, urlparse

from .workbench_input import RunConfig, WorkbenchMode, normalize_mode, read_input
from .workbench_runner import run_worker_process


ACTIVE_PHASES = {
    "starting",
    "waiting_login",
    "prepared",
    "checking_data",
    "data_checked",
    "running",
    "stopping",
}


def terminate_process_tree(process: multiprocessing.Process) -> None:
    if not process.is_alive() or process.pid is None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    process.join(timeout=5)
    if process.is_alive():
        process.kill()
        process.join(timeout=2)


class RunManager:
    def __init__(
        self,
        app_directory: Path,
        mode: WorkbenchMode,
        worker_target: Callable[[RunConfig, Any, Any], None] = run_worker_process,
    ):
        self.app_directory = app_directory
        self.mode = normalize_mode(mode)
        self.worker_target = worker_target
        self._lock = threading.RLock()
        self._process: multiprocessing.Process | None = None
        self._event_queue: Any = None
        self._command_queue: Any = None
        self._config: RunConfig | None = None
        self._state = self._idle_state()

    def _idle_state(self) -> dict[str, Any]:
        return {
            "phase": "idle",
            "message": "等待启动",
            "mode": self.mode,
            "modeLabel": "智能串行" if self.mode == "smart" else "原始串行",
            "runId": "",
            "progress": {"total": 0, "completed": 0, "success": 0, "failed": 0, "current": ""},
            "logs": [],
            "results": [],
            "downloads": {"result": False},
            "checks": {"data": {"ok": False, "message": "尚未检查数据"}},
        }

    def _apply_event(self, event: dict[str, Any]) -> None:
        event_type = event.get("type")
        if event_type == "status":
            self._state["phase"] = event.get("phase", self._state["phase"])
            self._state["message"] = event.get("message", "")
            if self._state["message"]:
                self._state["logs"].append({"level": "info", "message": self._state["message"]})
        elif event_type == "progress":
            self._state["progress"] = {
                key: event.get(key, "" if key == "current" else 0)
                for key in ("total", "completed", "success", "failed", "current")
            }
        elif event_type == "log":
            self._state["logs"].append(
                {"level": event.get("level", "info"), "message": event.get("message", "")}
            )
        elif event_type == "record_result":
            fields = (
                ("index", 0),
                ("segmentIndex", 0),
                ("employeeId", ""),
                ("name", ""),
                ("inputType", ""),
                ("actualType", ""),
                ("inputStartDate", ""),
                ("inputEndDate", ""),
                ("actualStartDate", ""),
                ("actualEndDate", ""),
                ("status", ""),
                ("portalStatus", ""),
                ("remark", ""),
                ("attempt", 1),
                ("recovery", ""),
            )
            self._state["results"].append({key: event.get(key, default) for key, default in fields})
        elif event_type == "result":
            self._state["downloads"] = {"result": True}
            self._state["resultPath"] = event.get("path", "")
        elif event_type == "completed":
            self._state["phase"] = "completed"
            self._state["message"] = event.get("message", "录入完成")
            self._state["progress"].update(
                {
                    "total": event.get("total", 0),
                    "completed": event.get("total", 0),
                    "success": event.get("success", 0),
                    "failed": event.get("failed", 0),
                    "current": "",
                }
            )
            self._state["downloads"] = {"result": True}
            self._state["resultPath"] = event.get("path", "")
            self._state["logs"].append({"level": "success", "message": self._state["message"]})
        elif event_type == "failed":
            self._state["phase"] = "failed"
            self._state["message"] = event.get("message", "录入失败")
            self._state["logs"].append({"level": "error", "message": self._state["message"]})

    def _drain_queue(self) -> None:
        if self._event_queue is None:
            return
        while True:
            try:
                self._apply_event(self._event_queue.get_nowait())
            except queue.Empty:
                break

    def _drain_events(self) -> None:
        self._drain_queue()
        if self._process is not None and not self._process.is_alive():
            self._process.join(timeout=0)
            self._drain_queue()
            if self._state["phase"] in ACTIVE_PHASES:
                self._state["phase"] = "failed"
                self._state["message"] = f"锁班进程已退出，退出码 {self._process.exitcode}"

    def _build_config(
        self,
        input_mode: str,
        pasted_text: str,
        excel_name: str,
        excel_bytes: bytes | None,
        whitelist_text: str,
        common_reason: str,
        conflict_recovery: bool,
        browser_path: str,
        auto_run: bool,
    ) -> RunConfig:
        run_id = f"{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
        run_directory = self.app_directory / "results" / run_id
        run_directory.mkdir(parents=True, exist_ok=True)
        input_path = ""
        if input_mode == "excel":
            if not excel_bytes:
                raise ValueError("请选择 Excel 文件")
            suffix = Path(excel_name).suffix or ".xlsx"
            input_file = run_directory / f"input{suffix}"
            input_file.write_bytes(excel_bytes)
            input_path = str(input_file)
        elif input_mode == "paste":
            if not pasted_text.strip():
                raise ValueError("请粘贴锁班数据")
        else:
            raise ValueError("不支持的输入方式")
        return RunConfig(
            run_id=run_id,
            mode=self.mode,
            input_mode=input_mode,
            output_directory=str(run_directory),
            input_path=input_path,
            pasted_text=pasted_text,
            whitelist_text=whitelist_text,
            common_reason=common_reason,
            conflict_recovery=bool(conflict_recovery and self.mode == "smart"),
            browser_path=browser_path.strip(),
            auto_run=auto_run,
        )

    def prepare(
        self,
        input_mode: str,
        pasted_text: str = "",
        excel_name: str = "",
        excel_bytes: bytes | None = None,
        whitelist_text: str = "",
        common_reason: str = "",
        conflict_recovery: bool = False,
        browser_path: str = "",
        auto_run: bool = False,
    ) -> dict[str, Any]:
        with self._lock:
            self._drain_events()
            process_alive = self._process is not None and self._process.is_alive()
            phase = self._state.get("phase", "")
            if process_alive and phase not in {"prepared", "data_checked", "completed", "failed"}:
                raise RuntimeError("已有锁班任务正在运行")
            config = self._build_config(
                input_mode,
                pasted_text,
                excel_name,
                excel_bytes,
                whitelist_text,
                common_reason,
                conflict_recovery,
                browser_path,
                auto_run,
            )
            if process_alive:
                if self._command_queue is None:
                    raise RuntimeError("当前浏览器会话不可用")
                self._config = config
                self._command_queue.put({"command": "prepare", "config": config})
                self._state = self._idle_state()
                self._state.update(
                    {
                        "phase": "running" if auto_run else "prepared",
                        "message": "已发送新一批录入" if auto_run else "新一批数据已准备，浏览器保持打开",
                        "runId": config.run_id,
                    }
                )
                return self.snapshot()

            context = multiprocessing.get_context("spawn")
            self._event_queue = context.Queue()
            self._command_queue = context.Queue()
            self._process = context.Process(
                target=self.worker_target,
                args=(config, self._event_queue, self._command_queue),
                name=f"lock-entry-{self.mode}-{config.run_id}",
            )
            self._config = config
            self._state = self._idle_state()
            self._state.update(
                {"phase": "starting", "message": "正在启动锁班浏览器", "runId": config.run_id}
            )
            self._process.start()
            return self.snapshot()

    def start(self, **kwargs: Any) -> dict[str, Any]:
        """Agent full-chain entry: open the portal and run as soon as it is ready."""
        return self.prepare(**kwargs, auto_run=True)

    def _require_process(self) -> multiprocessing.Process:
        self._drain_events()
        if self._process is None or not self._process.is_alive() or self._command_queue is None:
            raise RuntimeError("当前没有可操作的锁班页面")
        return self._process

    def check_data(self) -> dict[str, Any]:
        with self._lock:
            self._require_process()
            if self._config is None:
                raise RuntimeError("尚未准备锁班数据")
            self._state["phase"] = "checking_data"
            self._state["message"] = "正在检查锁班数据"
            try:
                records, errors = read_input(self._config)
                self._state["checks"]["data"] = {
                    "ok": bool(records),
                    "message": f"有效数据 {len(records)} 条，无效 {len(errors)} 条",
                    "details": {"valid": len(records), "invalid": len(errors)},
                }
                for error in errors:
                    self._state["logs"].append({"level": "error", "message": error})
            except Exception as error:
                self._state["checks"]["data"] = {
                    "ok": False,
                    "message": f"数据健康检查失败：{error}",
                    "details": {},
                }
                self._state["logs"].append(
                    {"level": "error", "message": self._state["checks"]["data"]["message"]}
                )
            self._state["phase"] = "data_checked"
            self._state["message"] = self._state["checks"]["data"]["message"]
            return self.snapshot()

    def run(self) -> dict[str, Any]:
        with self._lock:
            self._require_process()
            self._command_queue.put({"command": "run"})
            self._state["phase"] = "running"
            self._state["message"] = "已发送开始录入指令"
            return self.snapshot()

    def stop(self) -> dict[str, Any]:
        with self._lock:
            self._drain_events()
            if self._process is None or not self._process.is_alive():
                raise RuntimeError("当前没有正在运行的锁班浏览器")
            self._state["phase"] = "stopping"
            self._state["message"] = "正在终止锁班任务并关闭浏览器"
            terminate_process_tree(self._process)
            self._state["phase"] = "terminated"
            self._state["message"] = "锁班任务已终止，浏览器已关闭"
            self._state["progress"]["current"] = ""
            return copy.deepcopy(self._state)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._drain_events()
            state = copy.deepcopy(self._state)
            process_alive = self._process is not None and self._process.is_alive()
            phase = state.get("phase", "idle")
            can_reuse_browser = process_alive and phase in {"completed", "failed"}
            state["canPrepare"] = not process_alive or can_reuse_browser
            state["canReuseBrowser"] = can_reuse_browser
            state["canCheckData"] = process_alive and phase in {"prepared", "data_checked"}
            state["canRun"] = process_alive and phase in {"prepared", "data_checked"}
            state["canStop"] = process_alive
            return state

    def download_path(self) -> Path | None:
        with self._lock:
            self._drain_events()
            value = self._state.get("resultPath", "")
            path = Path(value) if value else None
            return path if path and path.is_file() else None

    def shutdown(self) -> None:
        with self._lock:
            if self._process is not None and self._process.is_alive():
                terminate_process_tree(self._process)
            self._command_queue = None


class LocalHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def _public_asset(app_directory: Path, filename: str) -> Path:
    packaged = app_directory / filename
    if packaged.is_file():
        return packaged
    return app_directory.parents[2] / filename


def create_server(
    app_directory: Path,
    mode: WorkbenchMode,
    port: int = 0,
    manager: RunManager | None = None,
) -> LocalHTTPServer:
    run_manager = manager or RunManager(app_directory, mode)
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
            }
            data = path.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_types.get(path.suffix.lower(), "application/octet-stream"))
            self.send_header("Content-Length", str(len(data)))
            if download:
                self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(path.name)}")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:
            path = urlparse(self.path).path
            if path == "/api/status":
                self._json(run_manager.snapshot())
                return
            if path == "/api/download/result":
                result_path = run_manager.download_path()
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

        def do_POST(self) -> None:
            path = urlparse(self.path).path
            try:
                if path in {"/api/prepare", "/api/start"}:
                    length = int(self.headers.get("Content-Length", "0"))
                    payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                    excel_data = payload.get("excelBase64", "")
                    launch = run_manager.start if path == "/api/start" else run_manager.prepare
                    state = launch(
                        input_mode=payload.get("inputMode", ""),
                        pasted_text=payload.get("pastedText", ""),
                        excel_name=payload.get("excelName", ""),
                        excel_bytes=base64.b64decode(excel_data) if excel_data else None,
                        whitelist_text=payload.get("whitelistText", ""),
                        common_reason=payload.get("commonReason", ""),
                        conflict_recovery=bool(payload.get("conflictRecovery", False)),
                        browser_path=payload.get("browserPath", ""),
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
            except (ValueError, RuntimeError, json.JSONDecodeError) as error:
                self._json({"error": str(error)}, HTTPStatus.CONFLICT)

        def log_message(self, _format: str, *_args: Any) -> None:
            return

    server = LocalHTTPServer(("127.0.0.1", port), Handler)
    server.run_manager = run_manager  # type: ignore[attr-defined]
    return server
