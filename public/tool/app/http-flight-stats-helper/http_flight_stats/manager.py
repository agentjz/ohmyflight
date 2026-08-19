from __future__ import annotations

import copy
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Callable

from .exporter import ResultExporter, describe_scope, normalize_scope
from .input_data import read_input
from .models import Event, InputPayload, QueryRecord
from .portal_client import PortalClient
from .runner import DEFAULT_MAX_WORKERS, BatchRunner


RunnerFactory = Callable[..., BatchRunner]
ExporterFactory = Callable[..., ResultExporter]


class RunManager:
    def __init__(
        self,
        app_directory: Path,
        client: PortalClient | None = None,
        runner_factory: RunnerFactory = BatchRunner,
        exporter_factory: ExporterFactory = ResultExporter,
    ):
        self.app_directory = app_directory.resolve()
        self.client = client or PortalClient()
        self.runner_factory = runner_factory
        self.exporter_factory = exporter_factory
        self._lock = threading.RLock()
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._paths: dict[str, Path] = {}
        self._state = self._initial_state()

    @staticmethod
    def _initial_state() -> dict[str, object]:
        return {
            "phase": "waiting_credentials",
            "message": "等待验证登录凭据",
            "concurrency": DEFAULT_MAX_WORKERS,
            "session": {"verified": False, "verifiedAt": "", "cookieCount": 0},
            "checks": {
                "data": {
                    "checked": False,
                    "ok": False,
                    "validCount": 0,
                    "invalidCount": 0,
                    "errors": [],
                }
            },
            "progress": {"total": 0, "completed": 0, "success": 0, "failed": 0, "current": ""},
            "logs": [],
            "results": [],
            "downloads": {"original": False, "stripped": False},
        }

    def _is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def _append_log(self, level: str, message: str) -> None:
        self._state["logs"].append(  # type: ignore[union-attr]
            {"level": level, "message": message, "time": datetime.now().strftime("%H:%M:%S")}
        )

    def _set_unverified(self) -> None:
        self._state["session"] = {"verified": False, "verifiedAt": "", "cookieCount": 0}

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            state = copy.deepcopy(self._state)
            running = self._is_running()
            verified = bool(state["session"]["verified"])  # type: ignore[index]
            state.update(
                {
                    "canVerify": not running,
                    "canCheckData": verified and not running,
                    "canRun": verified and not running,
                    "canStop": running,
                    "canReuseSession": verified and not running,
                }
            )
            return state

    def verify_credentials(self, credential_text: str) -> dict[str, object]:
        with self._lock:
            if self._is_running():
                raise RuntimeError("查询运行中，不能更换登录凭据")
            self._state["phase"] = "verifying_credentials"
            self._state["message"] = "正在验证登录凭据"
            self._append_log("info", "正在连接飞行门户并验证查询页面")
        try:
            summary = self.client.load_credentials(credential_text)
        except Exception as error:
            with self._lock:
                self.client.clear_credentials()
                self._set_unverified()
                self._state["phase"] = "waiting_credentials"
                self._state["message"] = str(error)
                self._append_log("error", str(error))
            raise
        with self._lock:
            self._state["session"] = {
                "verified": True,
                "verifiedAt": summary["verifiedAt"],
                "cookieCount": summary["cookieCount"],
            }
            self._state["phase"] = "credentials_ready"
            self._state["message"] = "登录凭据有效，查询接口已就绪"
            self._append_log("success", "凭据验证成功，纯 HTTP 查询接口已就绪")
            return self.snapshot()

    def _require_session(self) -> None:
        if not self._state["session"]["verified"]:  # type: ignore[index]
            raise RuntimeError("请先验证登录凭据")
        self.client.require_credentials()

    @staticmethod
    def _parse(payload: InputPayload) -> tuple[list[QueryRecord], list[str]]:
        normalize_scope(payload.scope)
        return read_input(payload)

    def check_data(self, payload: InputPayload) -> dict[str, object]:
        with self._lock:
            if self._is_running():
                raise RuntimeError("查询运行中，不能检查另一批数据")
            self._require_session()
            self._state["phase"] = "checking_data"
            self._state["message"] = "正在检查查询数据"
            self._append_log("info", "开始数据健康检查")
        records, errors = self._parse(payload)
        with self._lock:
            check = {
                "checked": True,
                "ok": bool(records) and not errors,
                "validCount": len(records),
                "invalidCount": len(errors),
                "errors": errors,
            }
            self._state["checks"] = {"data": check}
            self._state["phase"] = "data_checked"
            self._state["message"] = f"数据检查完成：有效 {len(records)} 条，无效 {len(errors)} 条"
            self._append_log("success" if check["ok"] else "warning", str(self._state["message"]))
            for error in errors:
                self._append_log("warning", error)
            return self.snapshot()

    def _handle_event(self, event: Event) -> None:
        with self._lock:
            event_type = event.get("type")
            if event_type == "progress":
                self._state["progress"] = {
                    key: event.get(key, "" if key == "current" else 0)
                    for key in ("total", "completed", "success", "failed", "current")
                }
            elif event_type == "record_result":
                self._state["results"].append(  # type: ignore[union-attr]
                    {key: value for key, value in event.items() if key != "type"}
                )
            elif event_type == "log":
                self._append_log(str(event.get("level", "info")), str(event.get("message", "")))

    def _worker(
        self,
        records: list[QueryRecord],
        input_errors: list[str],
        payload: InputPayload,
        run_id: str,
    ) -> None:
        runner = self.runner_factory(
            portal=self.client,
            max_workers=DEFAULT_MAX_WORKERS,
            stop_event=self._stop_event,
            emit=self._handle_event,
        )
        try:
            result = runner.run(records, payload.scope)
            with self._lock:
                self._state["phase"] = "writing"
                self._state["message"] = "查询已结束，正在一次性生成两个结果文件"
                self._append_log("info", str(self._state["message"]))
            exporter = self.exporter_factory(self.app_directory / "results" / run_id, run_id, payload.scope)
            paths = exporter.write(records, input_errors, result.outcomes)
            with self._lock:
                self._paths = {"original": paths.original, "stripped": paths.stripped}
                self._state["downloads"] = {"original": True, "stripped": True}
                self._state["progress"] = {
                    "total": len(records),
                    "completed": len(result.outcomes),
                    "success": result.success,
                    "failed": result.failed,
                    "current": "",
                }
                if result.session_expired:
                    self.client.clear_credentials()
                    self._set_unverified()
                    self._state["phase"] = "failed"
                    self._state["message"] = "登录凭据已失效，已停止派发新查询并保存当前结果"
                    level = "error"
                elif result.stopped:
                    self._state["phase"] = "terminated"
                    self._state["message"] = "查询已终止，当前结果已保存"
                    level = "warning"
                else:
                    self._state["phase"] = "completed"
                    self._state["message"] = f"查询完成：成功 {result.success}，失败 {result.failed}"
                    level = "success"
                self._append_log(level, str(self._state["message"]))
        except Exception as error:
            with self._lock:
                self._state["phase"] = "failed"
                self._state["message"] = f"批次查询失败：{error}"
                self._append_log("error", str(self._state["message"]))

    def run(self, payload: InputPayload) -> dict[str, object]:
        with self._lock:
            if self._is_running():
                raise RuntimeError("已有批次正在查询")
            self._require_session()
        records, errors = self._parse(payload)
        if not records:
            raise ValueError("没有可查询的有效数据")
        run_id = f"{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}"
        with self._lock:
            self._stop_event = threading.Event()
            self._paths = {}
            self._state.update(
                {
                    "phase": "running",
                    "message": f"开始并发查询 {len(records)} 条有效数据",
                    "runId": run_id,
                    "progress": {
                        "total": len(records),
                        "completed": 0,
                        "success": 0,
                        "failed": 0,
                        "current": f"并发查询中（{DEFAULT_MAX_WORKERS} 个 worker）",
                    },
                    "results": [],
                    "logs": [],
                    "downloads": {"original": False, "stripped": False},
                    "checks": {
                        "data": {
                            "checked": True,
                            "ok": not errors,
                            "validCount": len(records),
                            "invalidCount": len(errors),
                            "errors": errors,
                        }
                    },
                    "scopeLabel": describe_scope(payload.scope),
                }
            )
            self._append_log("info", str(self._state["message"]))
            for error in errors:
                self._append_log("warning", f"跳过无效数据：{error}")
            self._thread = threading.Thread(
                target=self._worker,
                args=(records, errors, payload, run_id),
                name="http-flight-stats-runner",
                daemon=True,
            )
            self._thread.start()
            return self.snapshot()

    def start(self, credential_text: str, payload: InputPayload) -> dict[str, object]:
        if credential_text.strip():
            self.verify_credentials(credential_text)
        with self._lock:
            self._require_session()
        self.check_data(payload)
        return self.run(payload)

    def stop(self) -> dict[str, object]:
        with self._lock:
            if not self._is_running():
                self._state["phase"] = "terminated"
                self._state["message"] = "当前没有运行中的查询"
                return self.snapshot()
            self._state["phase"] = "stopping"
            self._state["message"] = "正在终止当前查询"
            self._append_log("warning", str(self._state["message"]))
            self._stop_event.set()
            thread = self._thread
        thread.join(timeout=5)
        return self.snapshot()

    def download_path(self, kind: str) -> Path | None:
        with self._lock:
            path = self._paths.get(kind)
            return path if path and path.is_file() else None

    def shutdown(self) -> None:
        with self._lock:
            self._stop_event.set()
            thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=5)
        self.client.close()
