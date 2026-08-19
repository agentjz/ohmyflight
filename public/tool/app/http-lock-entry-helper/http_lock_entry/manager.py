"""In-memory session and batch state for the HTTP lock workbench."""

from __future__ import annotations

import copy
import hashlib
import json
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Callable

from .input_data import read_input
from .models import InputPayload, WorkbenchMode
from .portal_client import PortalClient, PortalSessionExpired
from .result_store import ResultStore
from .runner import BatchRunner


RunnerFactory = Callable[..., BatchRunner]
StoreFactory = Callable[[str | Path, str, str], ResultStore]


class RunManager:
    def __init__(
        self,
        app_directory: Path,
        mode: WorkbenchMode,
        client: PortalClient | None = None,
        runner_factory: RunnerFactory = BatchRunner,
        store_factory: StoreFactory = ResultStore,
    ):
        self.app_directory = app_directory.resolve()
        self.mode = mode
        self.client = client or PortalClient()
        self.runner_factory = runner_factory
        self.store_factory = store_factory
        self._lock = threading.RLock()
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._result_path = ""
        self._state = self._initial_state()

    def _initial_state(self) -> dict[str, object]:
        return {
            "phase": "waiting_credentials",
            "message": "等待验证登录凭据",
            "mode": self.mode,
            "modeLabel": "智能串行" if self.mode == "smart" else "原始串行",
            "session": {
                "verified": False,
                "verifiedAt": "",
                "typeCount": 0,
                "typeVersion": "",
            },
            "progress": {"total": 0, "completed": 0, "success": 0, "failed": 0, "current": ""},
            "checks": {"data": {"checked": False, "ok": False, "validCount": 0, "invalidCount": 0, "errors": []}},
            "logs": [],
            "results": [],
            "downloads": {"result": False},
        }

    def _is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def _append_log(self, level: str, message: str) -> None:
        self._state["logs"].append(
            {
                "level": level,
                "message": message,
                "time": datetime.now().strftime("%H:%M:%S"),
            }
        )

    def _controls(self, state: dict[str, object]) -> None:
        running = self._is_running()
        verified = bool(state.get("session", {}).get("verified"))
        state.update(
            {
                "canVerify": not running,
                "canCheckData": verified and not running,
                "canRun": verified and not running,
                "canStop": running,
                "canReuseSession": verified and not running,
            }
        )

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            state = copy.deepcopy(self._state)
            self._controls(state)
            return state

    def _metadata_version(self) -> str:
        metadata = self.client.require_metadata()
        source = [
            (item.code, item.label, item.limit_flag, item.date_split_flag)
            for item in metadata.lock_types.values()
        ]
        encoded = json.dumps(source, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()[:12]

    def verify_credentials(self, credential_text: str) -> dict[str, object]:
        with self._lock:
            if self._is_running():
                raise RuntimeError("录入运行中，不能更换登录凭据")
            self._state["phase"] = "verifying_credentials"
            self._state["message"] = "正在验证登录凭据"
            self._append_log("info", "正在连接飞行门户并验证登录凭据")
        try:
            metadata = self.client.load_credentials(credential_text)
        except Exception as error:
            with self._lock:
                self.client.metadata = None
                try:
                    self.client.session.cookies.clear()
                except Exception:
                    pass
                self._state["session"] = {
                    "verified": False,
                    "verifiedAt": "",
                    "typeCount": 0,
                    "typeVersion": "",
                }
                self._state["phase"] = "waiting_credentials"
                self._state["message"] = str(error)
                self._append_log("error", str(error))
            raise
        with self._lock:
            self._state["session"] = {
                "verified": True,
                "verifiedAt": self.client.verified_at,
                "typeCount": len(metadata.lock_types),
                "typeVersion": self._metadata_version(),
            }
            self._state["phase"] = "credentials_ready"
            self._state["message"] = "登录凭据有效，等待数据检查或开始录入"
            self._append_log("success", f"凭据验证成功，已加载 {len(metadata.lock_types)} 个当前锁班类型")
            return self.snapshot()

    def _require_session(self) -> None:
        if not self._state["session"]["verified"]:
            raise PortalSessionExpired("请先验证登录凭据")
        self.client.require_metadata()

    def _parse(self, payload: InputPayload) -> tuple[list[dict[str, object]], list[str]]:
        metadata = self.client.require_metadata()
        records, errors = read_input(payload, metadata, self.mode)
        if payload.common_reason and len(payload.common_reason.strip()) > 60:
            errors.append("统一备注不能超过60个字符")
        return records, errors

    def check_data(self, payload: InputPayload) -> dict[str, object]:
        with self._lock:
            if self._is_running():
                raise RuntimeError("录入运行中，不能检查另一批数据")
            self._require_session()
            self._state["phase"] = "checking_data"
            self._state["message"] = "正在检查数据"
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
            level = "success" if check["ok"] else "warning"
            self._append_log(level, self._state["message"])
            for problem in errors:
                self._append_log("warning", problem)
            return self.snapshot()

    def _handle_event(self, event: dict[str, object]) -> None:
        with self._lock:
            event_type = event.get("type")
            if event_type == "progress":
                self._state["progress"] = {
                    key: event.get(key, "" if key == "current" else 0)
                    for key in ("total", "completed", "success", "failed", "current")
                }
            elif event_type == "record_result":
                visible = {key: value for key, value in event.items() if key != "type"}
                self._state["results"].append(visible)
            elif event_type == "log":
                self._append_log(str(event.get("level", "info")), str(event.get("message", "")))

    def _worker(
        self,
        records: list[dict[str, object]],
        payload: InputPayload,
        store: ResultStore,
    ) -> None:
        runner_args = [
            self.client,
            store,
            self.mode,
            payload.conflict_recovery and self.mode == "smart",
            payload.common_reason,
            self._stop_event,
            self._handle_event,
        ]
        if payload.approve_after_submit:
            runner_args.append(True)
        runner = self.runner_factory(
            *runner_args,
        )
        try:
            summary = runner.run(records)
            with self._lock:
                stopped = bool(summary.get("stopped") or self._stop_event.is_set())
                self._state["phase"] = "terminated" if stopped else "completed"
                self._state["message"] = "录入已终止" if stopped else (
                    f"录入完成：成功 {summary['success']} 条，失败 {summary['failed']} 条"
                )
                self._state["downloads"] = {"result": True}
                self._append_log("warning" if stopped else "success", self._state["message"])
        except PortalSessionExpired as error:
            with self._lock:
                self.client.metadata = None
                self._state["session"] = {
                    "verified": False,
                    "verifiedAt": "",
                    "typeCount": 0,
                    "typeVersion": "",
                }
                self._state["phase"] = "failed"
                self._state["message"] = str(error)
                self._state["downloads"] = {"result": True}
                self._append_log("error", str(error))
        except Exception as error:
            with self._lock:
                self._state["phase"] = "failed"
                self._state["message"] = f"批次运行失败：{error}"
                self._state["downloads"] = {"result": True}
                self._append_log("error", self._state["message"])

    def run(self, payload: InputPayload) -> dict[str, object]:
        with self._lock:
            if self._is_running():
                raise RuntimeError("已有批次正在录入")
            self._require_session()
        records, errors = self._parse(payload)
        if not records:
            raise ValueError("没有可录入的有效数据")

        run_id = f"{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}"
        store = self.store_factory(self.app_directory / "results", run_id, self.mode)
        with self._lock:
            self._result_path = store.path
            self._stop_event = threading.Event()
            self._state.update(
                {
                    "phase": "running",
                    "message": f"开始串行录入 {len(records)} 条有效数据",
                    "runId": run_id,
                    "progress": {"total": len(records), "completed": 0, "success": 0, "failed": 0, "current": ""},
                    "results": [],
                    "logs": [],
                    "downloads": {"result": True},
                    "checks": {"data": {
                        "checked": True,
                        "ok": not errors,
                        "validCount": len(records),
                        "invalidCount": len(errors),
                        "errors": errors,
                    }},
                }
            )
            self._append_log("info", self._state["message"])
            for problem in errors:
                self._append_log("warning", f"跳过无效数据：{problem}")
            self._thread = threading.Thread(
                target=self._worker,
                args=(records, payload, store),
                name="http-lock-entry-runner",
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
                self._state["message"] = "当前没有运行中的批次"
                return self.snapshot()
            self._state["phase"] = "stopping"
            self._state["message"] = "正在终止当前批次"
            self._append_log("warning", self._state["message"])
            self._stop_event.set()
            thread = self._thread
        thread.join(timeout=5)
        return self.snapshot()

    def download_path(self) -> Path | None:
        with self._lock:
            path = Path(self._result_path) if self._result_path else None
            return path if path and path.is_file() else None

    def shutdown(self) -> None:
        with self._lock:
            self._stop_event.set()
            thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=5)
        close = getattr(self.client.session, "close", None)
        if callable(close):
            close()
