from __future__ import annotations

from datetime import datetime
from typing import Any


def initial_state() -> dict[str, Any]:
    return {
        "phase": "idle",
        "message": "等待导入登录态并进入查询页面",
        "runId": "",
        "session": {"loaded": False},
        "progress": {"total": 0, "completed": 0, "success": 0, "failed": 0, "current": ""},
        "logs": [],
        "results": [],
        "downloads": {"excel": False, "report": False},
        "checks": {"data": {"ok": False, "message": "尚未检查数据"}},
    }


def append_log(state: dict[str, Any], level: str, message: str) -> None:
    state["logs"].append(
        {"level": level, "message": message, "time": datetime.now().strftime("%H:%M:%S")}
    )


def apply_event(state: dict[str, Any], event: dict[str, Any]) -> None:
    event_type = event.get("type")
    if event_type == "status":
        state["phase"] = event.get("phase", state["phase"])
        state["message"] = event.get("message", "")
        if state["message"]:
            append_log(state, "info", state["message"])
    elif event_type == "progress":
        state["progress"] = {
            key: event.get(key, "" if key == "current" else 0)
            for key in ("total", "completed", "success", "failed", "current")
        }
    elif event_type == "log":
        append_log(state, str(event.get("level", "info")), str(event.get("message", "")))
    elif event_type == "record_result":
        state["results"].append(
            {
                key: event.get(key, default)
                for key, default in (
                    ("index", 0),
                    ("employeeId", ""),
                    ("inputName", ""),
                    ("pageName", ""),
                    ("technicalCount", 0),
                    ("operationCount", 0),
                    ("status", ""),
                    ("error", ""),
                )
            }
        )
    elif event_type == "result":
        state["resultPaths"] = {
            "excel": event.get("excel", ""),
            "report": event.get("report", ""),
        }
        state["downloads"]["excel"] = bool(event.get("excel"))
    elif event_type == "completed":
        state["phase"] = "completed"
        state["message"] = event.get("message", "查询完成")
        state["progress"].update(
            {
                "total": event.get("total", 0),
                "completed": event.get("total", 0),
                "success": event.get("success", 0),
                "failed": event.get("failed", 0),
                "current": "",
            }
        )
        state["resultPaths"] = {
            "excel": event.get("excel", ""),
            "report": event.get("report", ""),
        }
        state["downloads"] = {"excel": True, "report": True}
        append_log(state, "success", state["message"])
    elif event_type == "failed":
        state["phase"] = "failed"
        state["message"] = event.get("message", "查询失败")
        append_log(state, "error", state["message"])
