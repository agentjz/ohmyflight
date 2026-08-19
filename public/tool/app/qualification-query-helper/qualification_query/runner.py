from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable

from playwright.sync_api import sync_playwright

from .credentials import browser_cookies, parse_credentials
from .exporter import ResultExporter
from .input_data import read_input
from .models import Event, QueryRecord, RunConfig, RunSummary
from .portal import PortalClient, is_browser_closed_error


def run_records(
    records: list[QueryRecord],
    portal: Any,
    exporter: ResultExporter,
    emit: Callable[[Event], None],
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
            result = portal.query(record)
            exporter.write_success(index, record, result)
            success += 1
            emit(
                {
                    "type": "record_result",
                    "index": index,
                    "employeeId": record.employee_id,
                    "inputName": record.name,
                    "pageName": result.page_name,
                    "technicalCount": len(result.technical_rows),
                    "operationCount": len(result.operation_rows),
                    "status": "成功",
                    "error": "",
                }
            )
            emit(
                {
                    "type": "log",
                    "level": "success",
                    "message": f"{record.employee_id} 查询成功：技术等级 {len(result.technical_rows)} 条，运行资格 {len(result.operation_rows)} 条",
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
                    "inputName": record.name,
                    "pageName": "",
                    "technicalCount": 0,
                    "operationCount": 0,
                    "status": "失败",
                    "error": str(error),
                }
            )
            emit(
                {
                    "type": "log",
                    "level": "error",
                    "message": f"{record.employee_id} 查询失败：{error}",
                }
            )
            if is_browser_closed_error(error):
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


def read_config_input(config: RunConfig):
    return read_input(config.input_mode, config.input_path, config.pasted_text)


def run_batch(config: RunConfig, portal: PortalClient, emit: Callable[[Event], None]) -> None:
    try:
        records, input_issues = read_config_input(config)
        if not records:
            raise ValueError("没有可查询的有效人员")
        for issue in input_issues:
            emit({"type": "log", "level": "warning", "message": str(issue)})

        exporter = ResultExporter(Path(config.output_directory), config.run_id)
        exporter.initialize(records, input_issues)
        emit(
            {
                "type": "result",
                "excel": str(exporter.paths.excel),
                "report": str(exporter.paths.report),
            }
        )
        emit({"type": "status", "phase": "running", "message": f"开始严格串行查询 {len(records)} 人"})
        summary = run_records(records, portal, exporter, emit)
        paths = exporter.finalize(
            total=summary.total,
            success=summary.success,
            failed=summary.failed,
            input_errors=len(input_issues),
            interrupted=summary.interrupted,
            input_source=config.input_path or "粘贴输入",
        )
        emit(
            {
                "type": "completed",
                "message": f"查询完成：成功 {summary.success}，失败 {summary.failed}；浏览器保持打开",
                "total": summary.total,
                "success": summary.success,
                "failed": summary.failed,
                "excel": str(paths.excel),
                "report": str(paths.report),
            }
        )
    except Exception as error:
        if is_browser_closed_error(error):
            raise
        emit({"type": "failed", "message": str(error)})


def run_worker(config: RunConfig, event_queue: Any, command_queue: Any) -> None:
    emit = event_queue.put
    try:
        cookies = parse_credentials(config.credentials)
        emit({"type": "status", "phase": "starting", "message": "正在打开 Playwright 浏览器"})
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=False)
            context = browser.new_context()
            context.set_default_timeout(15000)
            context.add_cookies(browser_cookies(cookies))
            page = context.new_page()
            portal = PortalClient(page, emit)
            portal.open_material_management()
            emit({"type": "status", "phase": "prepared", "message": "资料管理页面已就绪，等待开始查询"})

            current_config = config
            if config.auto_run:
                run_batch(current_config, portal, emit)
            while True:
                command = command_queue.get()
                command_name = command.get("command", "") if isinstance(command, dict) else command
                next_config = command.get("config") if isinstance(command, dict) else None
                if command_name == "prepare" and isinstance(next_config, RunConfig):
                    current_config = next_config
                    emit({"type": "status", "phase": "prepared", "message": "下一批数据已准备，资料管理页面保持打开"})
                    if current_config.auto_run:
                        run_batch(current_config, portal, emit)
                elif command_name == "run":
                    run_batch(current_config, portal, emit)
    except Exception as error:
        emit({"type": "failed", "message": str(error)})


def run_worker_process(config: RunConfig, event_queue: Any, command_queue: Any) -> None:
    if os.name != "nt":
        try:
            os.setsid()
        except OSError:
            pass
    run_worker(config, event_queue, command_queue)
