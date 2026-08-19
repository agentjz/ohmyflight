from __future__ import annotations

import threading
from typing import Callable

from .exporter import ScopeValue, select_result_headers
from .models import BatchResult, Event, QueryOutcome, QueryRecord, TableResult
from .portal_client import PortalSessionExpired


class BatchRunner:
    def __init__(
        self,
        portal: object,
        stop_event: threading.Event | None = None,
        emit: Callable[[Event], None] | None = None,
    ):
        self.portal = portal
        self.stop_event = stop_event or threading.Event()
        self.emit = emit or (lambda _event: None)

    def _query_one(self, index: int, record: QueryRecord, scope: ScopeValue) -> QueryOutcome:
        result: TableResult = self.portal.query(record)  # type: ignore[attr-defined]
        select_result_headers(result.headers, scope)
        return QueryOutcome(index=index, record=record, status="成功", result=result)

    def _emit_outcome(self, outcome: QueryOutcome, scope: ScopeValue) -> None:
        headers = (
            select_result_headers(outcome.result.headers, scope)
            if outcome.status == "成功" and outcome.result
            else []
        )
        self.emit(
            {
                "type": "record_result",
                "index": outcome.index,
                "employeeId": outcome.record.employee_id,
                "name": outcome.record.name,
                "startDate": outcome.record.start_date.isoformat(),
                "endDate": outcome.record.end_date.isoformat(),
                "status": outcome.status,
                "headers": headers,
                "values": {header: outcome.result.values.get(header, "") for header in headers}
                if outcome.result
                else {},
                "error": outcome.error,
            }
        )

    def run(self, records: list[QueryRecord], scope: ScopeValue) -> BatchResult:
        total = len(records)
        outcomes: dict[int, QueryOutcome] = {}
        success = 0
        session_expired = False

        self.emit(
            {
                "type": "progress",
                "total": total,
                "completed": 0,
                "success": 0,
                "failed": 0,
                "current": "正在逐人查询（严格串行）",
            }
        )
        for index, record in enumerate(records):
            if self.stop_event.is_set() or session_expired:
                break
            try:
                outcome = self._query_one(index, record, scope)
            except PortalSessionExpired as error:
                session_expired = True
                outcome = QueryOutcome(index, record, "失败", error=str(error))
            except Exception as error:
                outcome = QueryOutcome(index, record, "失败", error=str(error))
            outcomes[index] = outcome
            success += outcome.status == "成功"
            self._emit_outcome(outcome, scope)
            self.emit(
                {
                    "type": "log",
                    "level": "success" if outcome.status == "成功" else "error",
                    "message": f"第{index + 1}条查询{outcome.status}",
                }
            )
            self.emit(
                {
                    "type": "progress",
                    "total": total,
                    "completed": len(outcomes),
                    "success": success,
                    "failed": len(outcomes) - success,
                    "current": "" if len(outcomes) == total else "正在逐人查询（严格串行）",
                }
            )

        if self.stop_event.is_set() or session_expired:
            reason = "查询已终止" if self.stop_event.is_set() else "登录凭据已失效，未继续查询"
            status = "已终止" if self.stop_event.is_set() else "失败"
            for index, record in enumerate(records):
                if index in outcomes:
                    continue
                outcome = QueryOutcome(index, record, status, error=reason)
                outcomes[index] = outcome
                self._emit_outcome(outcome, scope)

        ordered = [outcomes[index] for index in sorted(outcomes)]
        return BatchResult(ordered, self.stop_event.is_set(), session_expired)
