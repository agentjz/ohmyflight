from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from playwright.sync_api import sync_playwright

from .exporter import ResultExporter, ScopeValue, describe_scope
from .input_data import QueryRecord, parse_pasted_records, read_excel_records
from .portal import PortalClient


@dataclass(frozen=True)
class RunConfig:
    run_id: str
    input_mode: str
    output_directory: str
    input_path: str = ""
    pasted_text: str = ""
    scope: ScopeValue = "all"
    auto_run: bool = False


@dataclass(frozen=True)
class RunSummary:
    total: int
    success: int
    failed: int


def _browser_closed(error: Exception) -> bool:
    message = str(error).lower()
    return any(
        marker in message
        for marker in (
            "target page, context or browser has been closed",
            "browser has been closed",
            "page has been closed",
        )
    )


def run_records(
    records: list[QueryRecord],
    portal: Any,
    exporter: ResultExporter,
    emit: Callable[[dict[str, Any]], None],
) -> RunSummary:
    success = 0
    failed = 0
    total = len(records)
    for index, record in enumerate(records):
        emit(
            {
                "type": "progress",
                "total": total,
                "completed": index,
                "success": success,
                "failed": failed,
                "current": f"{record.employee_id} {record.name}".strip(),
            }
        )
        try:
            result = portal.query(record, clear_first=index > 0)
            exporter.write_success(index, record, result)
            success += 1
            display_headers = exporter.selected_headers(result)
            emit(
                {
                    "type": "record_result",
                    "index": index,
                    "employeeId": record.employee_id,
                    "name": record.name,
                    "startDate": record.start_date.isoformat(),
                    "endDate": record.end_date.isoformat(),
                    "status": "成功",
                    "headers": display_headers,
                    "values": {header: result.values.get(header, "") for header in display_headers},
                    "error": "",
                }
            )
            emit(
                {
                    "type": "log",
                    "level": "success",
                    "message": f"{record.employee_id} {record.name} 查询成功".strip(),
                }
            )
        except Exception as error:
            failed += 1
            exporter.write_failure(index, record, str(error))
            emit(
                {
                    "type": "record_result",
                    "index": index,
                    "employeeId": record.employee_id,
                    "name": record.name,
                    "startDate": record.start_date.isoformat(),
                    "endDate": record.end_date.isoformat(),
                    "status": "失败",
                    "headers": [],
                    "values": {},
                    "error": str(error),
                }
            )
            emit(
                {
                    "type": "log",
                    "level": "error",
                    "message": f"{record.employee_id} {record.name} 查询失败：{error}".strip(),
                }
            )
            if _browser_closed(error):
                raise
        emit(
            {
                "type": "progress",
                "total": total,
                "completed": index + 1,
                "success": success,
                "failed": failed,
                "current": "",
            }
        )
    return RunSummary(total=total, success=success, failed=failed)


def read_input(config: RunConfig) -> tuple[list[QueryRecord], list[str]]:
    if config.input_mode == "excel":
        if not config.input_path:
            raise ValueError("没有收到 Excel 文件")
        return read_excel_records(config.input_path)
    if config.input_mode == "paste":
        return parse_pasted_records(config.pasted_text)
    raise ValueError(f"不支持的输入方式：{config.input_mode}")


def run_batch(
    config: RunConfig,
    portal: PortalClient,
    emit: Callable[[dict[str, Any]], None],
) -> None:
    """在已登录的浏览器会话中运行一批数据，完成后保留会话等待下一批。"""
    try:
        records, input_errors = read_input(config)
        for message in input_errors:
            emit({"type": "log", "level": "error", "message": message})
        if not records:
            raise ValueError("没有可处理的记录")

        exporter = ResultExporter(Path(config.output_directory), config.run_id, config.scope)
        exporter.initialize(records, input_errors)
        emit(
            {
                "type": "result",
                "original": str(exporter.paths.original),
                "stripped": str(exporter.paths.stripped),
            }
        )
        emit({"type": "status", "phase": "running", "message": "正在逐人查询"})
        summary = run_records(records, portal, exporter, emit)
        emit(
            {
                "type": "completed",
                "message": f"查询完成：成功 {summary.success}，失败 {summary.failed}；浏览器保持打开",
                "total": summary.total,
                "success": summary.success,
                "failed": summary.failed,
                "original": str(exporter.paths.original),
                "stripped": str(exporter.paths.stripped),
            }
        )
    except Exception as error:
        if _browser_closed(error):
            raise
        emit({"type": "failed", "message": str(error)})


def run_worker(config: RunConfig, event_queue: Any, command_queue: Any | None = None) -> None:
    emit = event_queue.put
    try:
        emit({"type": "status", "phase": "starting", "message": f"查询范围：{describe_scope(config.scope)}"})
        emit({"type": "status", "phase": "starting", "message": "正在打开浏览器"})
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=False)
            context = browser.new_context()
            context.set_default_timeout(30000)
            page = context.new_page()
            portal = PortalClient(page, emit)
            portal.login_and_open()

            if command_queue is None:
                run_batch(config, portal, emit)
                return

            current_config = config
            if config.auto_run:
                run_batch(current_config, portal, emit)
            while True:
                command = command_queue.get()
                if isinstance(command, dict):
                    command_name = command.get("command", "")
                    next_config = command.get("config")
                else:
                    command_name = command
                    next_config = None
                if command_name == "prepare" and isinstance(next_config, RunConfig):
                    current_config = next_config
                    emit(
                        {
                            "type": "status",
                            "phase": "prepared",
                            "message": "新一批数据已准备，浏览器保持打开，等待开始查询",
                        }
                    )
                    if current_config.auto_run:
                        run_batch(current_config, portal, emit)
                elif command_name == "run":
                    run_batch(current_config, portal, emit)
    except Exception as error:
        emit({"type": "failed", "message": str(error)})


def run_worker_process(config: RunConfig, event_queue: Any, command_queue: Any | None = None) -> None:
    if os.name != "nt":
        try:
            os.setsid()
        except OSError:
            pass
    run_worker(config, event_queue, command_queue)
