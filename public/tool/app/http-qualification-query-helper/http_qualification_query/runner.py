from __future__ import annotations

import threading
from typing import Callable

from .exporter import ResultExporter
from .models import Event, InputIssue, QueryRecord, RunSummary
from .portal_client import PortalSessionExpired


class BatchRunner:
    def __init__(
        self,
        portal: object,
        exporter: ResultExporter,
        stop_event: threading.Event | None = None,
        emit: Callable[[Event], None] | None = None,
    ):
        self.portal = portal
        self.exporter = exporter
        self.stop_event = stop_event or threading.Event()
        self.emit = emit or (lambda _event: None)

    def run(self, records: list[QueryRecord], input_issues: list[InputIssue]) -> RunSummary:
        self.exporter.initialize(records, input_issues)
        success = 0
        failed = 0
        session_expired = False
        completed = 0
        self.emit(
            {
                "type": "result",
                "excel": str(self.exporter.paths.excel),
                "report": str(self.exporter.paths.report),
                "json": str(self.exporter.paths.json),
            }
        )

        for index, record in enumerate(records):
            if self.stop_event.is_set() or session_expired:
                break
            current = f"{record.employee_id} {record.name}".strip()
            self.emit(
                {
                    "type": "progress",
                    "total": len(records),
                    "completed": completed,
                    "success": success,
                    "failed": failed,
                    "current": current,
                }
            )
            try:
                result = self.portal.query(record)  # type: ignore[attr-defined]
                self.exporter.write_success(index, record, result)
                success += 1
                event = {
                    "type": "record_result",
                    "index": index,
                    "employeeId": record.employee_id,
                    "inputName": record.name,
                    "pageName": result.page_name,
                    "basicCount": result.basic_count,
                    "technicalCount": len(result.technical_rows),
                    "operationCount": len(result.operation_rows),
                    "trainingRecordCount": len(result.training_record_rows),
                    "trainingExperienceCount": len(result.training_experience_rows),
                    "status": "成功",
                    "error": "",
                }
                message = (
                    f"第{index + 1}条查询成功：基础信息 {result.basic_count} 条，"
                    f"技术等级 {len(result.technical_rows)} 条，运行资格 {len(result.operation_rows)} 条，"
                    f"培训记录 {len(result.training_record_rows)} 条，训练经历 {len(result.training_experience_rows)} 条"
                )
                level = "success"
            except PortalSessionExpired as error:
                session_expired = True
                failed += 1
                self.exporter.write_failure(index, record, str(error))
                event = self._failure_event(index, record, str(error))
                message = f"第{index + 1}条查询失败：{error}"
                level = "error"
            except Exception as error:
                failed += 1
                self.exporter.write_failure(index, record, str(error))
                event = self._failure_event(index, record, str(error))
                message = f"第{index + 1}条查询失败：{error}"
                level = "error"
            completed += 1
            self.emit(event)
            self.emit({"type": "log", "level": level, "message": message})
            self.emit(
                {
                    "type": "progress",
                    "total": len(records),
                    "completed": completed,
                    "success": success,
                    "failed": failed,
                    "current": "",
                }
            )

        return RunSummary(
            total=len(records),
            success=success,
            failed=failed,
            interrupted=self.stop_event.is_set(),
            session_expired=session_expired,
        )

    @staticmethod
    def _failure_event(index: int, record: QueryRecord, error: str) -> Event:
        return {
            "type": "record_result",
            "index": index,
            "employeeId": record.employee_id,
            "inputName": record.name,
            "pageName": "",
            "basicCount": 0,
            "technicalCount": 0,
            "operationCount": 0,
            "trainingRecordCount": 0,
            "trainingExperienceCount": 0,
            "status": "失败",
            "error": error,
        }
