from __future__ import annotations

import copy
import multiprocessing
import os
import queue
import signal
import subprocess
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from .credentials import parse_credentials
from .input_data import read_input
from .models import RunConfig
from .runner import run_worker_process
from .state import append_log, apply_event, initial_state


ACTIVE_PHASES = {"starting", "prepared", "checking_data", "data_checked", "running", "stopping"}


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
        worker_target: Callable[[RunConfig, Any, Any], None] = run_worker_process,
    ):
        self.app_directory = app_directory.resolve()
        self.worker_target = worker_target
        self._lock = threading.RLock()
        self._process: multiprocessing.Process | None = None
        self._event_queue: Any = None
        self._command_queue: Any = None
        self._config: RunConfig | None = None
        self._has_credentials = False
        self._state = initial_state()

    def _append_log(self, level: str, message: str) -> None:
        append_log(self._state, level, message)

    def _apply_event(self, event: dict[str, Any]) -> None:
        apply_event(self._state, event)

    def _drain_events(self) -> None:
        if self._event_queue is not None:
            while True:
                try:
                    self._apply_event(self._event_queue.get_nowait())
                except queue.Empty:
                    break
        if self._process is not None and not self._process.is_alive():
            self._process.join(timeout=0)
            if self._event_queue is not None:
                while True:
                    try:
                        self._apply_event(self._event_queue.get_nowait())
                    except queue.Empty:
                        break
            if self._state["phase"] in ACTIVE_PHASES:
                self._state["phase"] = "failed"
                self._state["message"] = f"查询进程已退出，退出码 {self._process.exitcode}"

    def _build_config(
        self,
        credentials: str,
        input_mode: str,
        pasted_text: str,
        excel_name: str,
        excel_bytes: bytes | None,
        auto_run: bool,
    ) -> RunConfig:
        run_id = f"{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
        run_directory = self.app_directory / "results" / run_id
        run_directory.mkdir(parents=True, exist_ok=True)
        input_path = ""
        if input_mode == "excel":
            if not excel_bytes:
                raise ValueError("请选择 Excel 文件")
            suffix = Path(excel_name).suffix.lower() or ".xlsx"
            if suffix not in {".xlsx", ".xlsm"}:
                raise ValueError("只支持 .xlsx 或 .xlsm 文件")
            input_file = run_directory / f"input{suffix}"
            input_file.write_bytes(excel_bytes)
            input_path = str(input_file)
        elif input_mode == "paste":
            if not pasted_text.strip():
                raise ValueError("请粘贴查询人员")
        else:
            raise ValueError("不支持的输入方式")
        return RunConfig(
            run_id=run_id,
            credentials=credentials,
            input_mode=input_mode,
            output_directory=str(run_directory),
            input_path=input_path,
            pasted_text=pasted_text,
            auto_run=auto_run,
        )

    def prepare(
        self,
        credentials: str,
        input_mode: str,
        pasted_text: str = "",
        excel_name: str = "",
        excel_bytes: bytes | None = None,
        auto_run: bool = False,
    ) -> dict[str, Any]:
        with self._lock:
            self._drain_events()
            process_alive = self._process is not None and self._process.is_alive()
            phase = self._state.get("phase", "")
            if process_alive and phase not in {"prepared", "data_checked", "completed", "failed"}:
                raise RuntimeError("已有查询正在运行")

            credential_text = credentials.strip()
            if not process_alive:
                parse_credentials(credential_text)
            elif not self._has_credentials:
                raise RuntimeError("当前浏览器没有可复用的登录态")

            config = self._build_config(
                credential_text if not process_alive else "",
                input_mode,
                pasted_text,
                excel_name,
                excel_bytes,
                auto_run,
            )
            if process_alive:
                if self._command_queue is None:
                    raise RuntimeError("当前浏览器会话不可用")
                self._config = config
                self._command_queue.put({"command": "prepare", "config": config})
                self._state.update(
                    {
                        "phase": "running" if auto_run else "prepared",
                        "message": "已发送下一批查询" if auto_run else "下一批数据已准备，资料管理页面保持打开",
                        "runId": config.run_id,
                        "progress": {"total": 0, "completed": 0, "success": 0, "failed": 0, "current": ""},
                        "results": [],
                        "logs": [],
                        "downloads": {"excel": False, "report": False},
                        "checks": {"data": {"ok": False, "message": "尚未检查数据"}},
                    }
                )
                return self.snapshot()

            context = multiprocessing.get_context("spawn")
            self._event_queue = context.Queue()
            self._command_queue = context.Queue()
            self._process = context.Process(
                target=self.worker_target,
                args=(config, self._event_queue, self._command_queue),
                name=f"qualification-query-{config.run_id}",
            )
            self._config = config
            self._has_credentials = True
            self._state = initial_state()
            self._state.update(
                {
                    "phase": "starting",
                    "message": "正在启动 Playwright 浏览器",
                    "runId": config.run_id,
                    "session": {"loaded": True},
                }
            )
            self._append_log("info", "登录 Cookie 已导入本次浏览器会话")
            self._process.start()
            return self.snapshot()

    def start(self, credentials: str, **payload: Any) -> dict[str, Any]:
        """供 agent 使用的全链路入口。"""
        return self.prepare(credentials, auto_run=True, **payload)

    def _require_process(self) -> multiprocessing.Process:
        self._drain_events()
        if self._process is None or not self._process.is_alive() or self._command_queue is None:
            raise RuntimeError("当前没有可操作的查询页面")
        return self._process

    def check_data(self) -> dict[str, Any]:
        with self._lock:
            self._require_process()
            if self._config is None:
                raise RuntimeError("尚未准备查询数据")
            self._state["phase"] = "checking_data"
            self._state["message"] = "正在检查查询数据"
            try:
                records, issues = read_input(
                    self._config.input_mode,
                    self._config.input_path,
                    self._config.pasted_text,
                )
                message = f"有效数据 {len(records)} 条，无效 {len(issues)} 条"
                self._state["checks"]["data"] = {
                    "ok": bool(records),
                    "message": message,
                    "details": {"valid": len(records), "invalid": len(issues)},
                }
                for issue in issues:
                    self._append_log("warning", str(issue))
            except Exception as error:
                message = f"数据健康检查失败：{error}"
                self._state["checks"]["data"] = {"ok": False, "message": message, "details": {}}
                self._append_log("error", message)
            self._state["phase"] = "data_checked"
            self._state["message"] = message
            return self.snapshot()

    def run(self) -> dict[str, Any]:
        with self._lock:
            self._require_process()
            self._command_queue.put({"command": "run"})
            self._state["phase"] = "running"
            self._state["message"] = "已发送开始查询指令"
            return self.snapshot()

    def stop(self) -> dict[str, Any]:
        with self._lock:
            self._drain_events()
            if self._process is None or not self._process.is_alive():
                raise RuntimeError("当前没有打开的查询浏览器")
            self._state["phase"] = "stopping"
            self._state["message"] = "正在停止并关闭浏览器"
            terminate_process_tree(self._process)
            self._has_credentials = False
            self._state["phase"] = "terminated"
            self._state["message"] = "查询已停止，浏览器已关闭"
            self._state["session"] = {"loaded": False}
            self._state["progress"]["current"] = ""
            return copy.deepcopy(self._state)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._drain_events()
            state = copy.deepcopy(self._state)
            process_alive = self._process is not None and self._process.is_alive()
            phase = state.get("phase", "idle")
            reusable = process_alive and phase in {"prepared", "data_checked", "completed", "failed"}
            state["session"] = {"loaded": bool(process_alive and self._has_credentials)}
            state["canPrepare"] = not process_alive or reusable
            state["canCheckData"] = process_alive and phase in {"prepared", "data_checked"}
            state["canRun"] = process_alive and phase in {"prepared", "data_checked"}
            state["canStop"] = process_alive
            state["canReuseBrowser"] = reusable
            return state

    def download_path(self, kind: str) -> Path | None:
        with self._lock:
            self._drain_events()
            value = self._state.get("resultPaths", {}).get(kind, "")
            path = Path(value) if value else None
            return path if path and path.is_file() else None

    def shutdown(self) -> None:
        with self._lock:
            if self._process is not None and self._process.is_alive():
                terminate_process_tree(self._process)
            self._has_credentials = False
            self._command_queue = None
