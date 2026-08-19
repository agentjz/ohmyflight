"""Serial orchestration for original and smart HTTP lock entry."""

from __future__ import annotations

import threading
from datetime import date
from typing import Callable

from .metadata import normalize_text
from .portal_client import PortalClient, PortalError, PortalSessionExpired
from .result_store import ResultStore
from .routing import SMART_LEAVE_TYPES, choose_unlock_candidate, route_record, unlocked_record_note


EventCallback = Callable[[dict[str, object]], None]


class BatchRunner:
    def __init__(
        self,
        client: PortalClient,
        store: ResultStore,
        mode: str,
        conflict_recovery: bool,
        common_reason: str,
        stop_event: threading.Event,
        emit: EventCallback | None = None,
        approve_after_submit: bool = False,
    ):
        self.client = client
        self.store = store
        self.mode = mode
        self.conflict_recovery = bool(conflict_recovery)
        self.common_reason = common_reason
        self.approve_after_submit = bool(approve_after_submit)
        self.stop_event = stop_event
        self.emit = emit or (lambda _event: None)

    def _log(self, level: str, message: str) -> None:
        self.emit({"type": "log", "level": level, "message": message})

    def _result_row(
        self,
        index: int,
        segment_index: int,
        source: dict[str, object],
        segment: dict[str, object],
        identity_name: str,
        status: str,
        *,
        portal_row: dict[str, str] | None = None,
        attempt: int = 1,
        recovery: str = "",
        remark: str = "",
        message: str = "",
    ) -> dict[str, object]:
        portal_row = portal_row or {}
        start_value = normalize_text(portal_row.get("开始日期") or portal_row.get("开始时间"))
        end_value = normalize_text(portal_row.get("结束日期") or portal_row.get("结束时间"))
        if not start_value:
            if int(segment.get("时间模式", 1)) == 1:
                start_value = f"{segment.get('开始日期', '')} {segment.get('开始时间', '')}"
                end_value = f"{segment.get('结束日期', '')} {segment.get('结束时间', '')}"
            else:
                start_value = f"{segment.get('月份', '')} {segment.get('日期列表', '')} {segment.get('开始时间', '')}"
                end_value = f"{segment.get('月份', '')} {segment.get('日期列表', '')} {segment.get('结束时间', '')}"
        metadata = self.client.metadata
        actual_code = str(segment.get("请假类型", ""))
        actual_item = metadata.lock_types.get(actual_code) if metadata else None
        input_code = str(source.get("请假类型", ""))
        input_item = metadata.lock_types.get(input_code) if metadata else None
        return {
            "type": "record_result",
            "index": index,
            "segmentIndex": segment_index,
            "sourceRow": source.get("来源行", ""),
            "employeeId": source.get("员工号", ""),
            "expectedName": source.get("姓名", "") or "",
            "name": identity_name,
            "inputType": input_item.description if input_item else input_code,
            "actualType": actual_item.description if actual_item else actual_code,
            "inputStartDate": source.get("开始日期", ""),
            "inputEndDate": source.get("结束日期", ""),
            "actualStartDateTime": start_value,
            "actualEndDateTime": end_value,
            "timeMode": segment.get("时间模式", 1),
            "status": status,
            "portalStatus": normalize_text(portal_row.get("锁班结果") or portal_row.get("锁班状态")),
            "attempt": attempt,
            "recovery": recovery,
            "remark": remark,
            "message": message,
        }

    def _persist_and_emit(self, row: dict[str, object]) -> None:
        self.store.append(row)
        self.emit(row)

    def _segments(self, record: dict[str, object]) -> tuple[list[dict[str, object]], str]:
        lock_type = str(record.get("请假类型", ""))
        if self.mode != "smart" or lock_type not in SMART_LEAVE_TYPES:
            return route_record(record, {})
        year = date.fromisoformat(str(record.get("开始日期", ""))).year
        available = {
            code: self.client.fetch_available_days(str(record.get("员工号", "")), code, year)
            for code in SMART_LEAVE_TYPES
        }
        return route_record(record, available)

    def _successful_rows(
        self,
        index: int,
        segment_index: int,
        source: dict[str, object],
        segment: dict[str, object],
        identity_name: str,
        rows: list[dict[str, str]],
        attempt: int,
        recovery: str,
        reason: str,
    ) -> None:
        for row in rows:
            event = self._result_row(
                index,
                segment_index,
                source,
                segment,
                identity_name,
                "成功",
                portal_row=row,
                attempt=attempt,
                recovery=recovery,
                remark=reason,
            )
            self._persist_and_emit(event)

    def _complete_success(
        self,
        index: int,
        segment_index: int,
        source: dict[str, object],
        segment: dict[str, object],
        identity_name: str,
        rows: list[dict[str, str]],
        attempt: int,
        recovery: str,
        reason: str,
    ) -> bool:
        self._successful_rows(
            index,
            segment_index,
            source,
            segment,
            identity_name,
            rows,
            attempt,
            recovery,
            reason,
        )
        if not self.approve_after_submit:
            return True
        try:
            message = self.client.approve_records(rows, reason)
        except Exception as error:
            failed = self._result_row(
                index,
                segment_index,
                source,
                segment,
                identity_name,
                "通过失败",
                portal_row=rows[0],
                attempt=attempt,
                recovery=recovery,
                remark=reason,
                message=f"待审批记录已生成，但通过并锁班失败：{error}",
            )
            self._persist_and_emit(failed)
            return False
        for row in rows:
            locked_row = dict(row)
            locked_row["锁班状态"] = "已锁"
            locked_row["状态"] = "已锁"
            approved = self._result_row(
                index,
                segment_index,
                source,
                segment,
                identity_name,
                "已通过并锁班",
                portal_row=locked_row,
                attempt=attempt,
                recovery=recovery,
                remark=reason,
                message=message,
            )
            self._persist_and_emit(approved)
        return True

    def _submit_segment(
        self,
        index: int,
        segment_index: int,
        source: dict[str, object],
        segment: dict[str, object],
        identity: object,
    ) -> bool:
        metadata = self.client.require_metadata()
        item = metadata.lock_types.get(str(segment.get("请假类型", "")))
        if item is None:
            raise PortalError("智能路由后的类型不在当前门户列表中")
        reason = self.client.resolve_reason(segment, self.common_reason)
        body = self.client.build_submit_data(segment, identity, item, reason)
        result = self.client.submit(body)
        rows, problem = self.client.attribute_submit_result(result, segment, identity)
        if rows:
            return self._complete_success(
                index, segment_index, source, segment, identity.name, rows, 1, "", reason
            )

        if not result.conflict_rows:
            event = self._result_row(
                index, segment_index, source, segment, identity.name, "失败",
                attempt=1, remark=reason, message=problem,
            )
            self._persist_and_emit(event)
            return False

        conflict_rows, conflict_problem = self.client.attribute_conflict_result(result, segment, identity)
        conflict_event = self._result_row(
            index,
            segment_index,
            source,
            segment,
            identity.name,
            "冲突",
            portal_row=conflict_rows[0] if conflict_rows else result.conflict_rows[0],
            attempt=1,
            remark=reason,
            message=conflict_problem or normalize_text(result.conflict_rows[0].get("冲突说明")),
        )
        self._persist_and_emit(conflict_event)
        if conflict_problem or not self.conflict_recovery:
            return False

        locked_rows = self.client.query_records(str(segment.get("员工号", "")), "已锁")
        candidate, candidate_problem = choose_unlock_candidate(locked_rows, segment)
        if candidate is None:
            event = self._result_row(
                index, segment_index, source, segment, identity.name, "回退失败",
                attempt=1, recovery="未解锁", remark=reason, message=candidate_problem,
            )
            self._persist_and_emit(event)
            return False

        evidence = self._result_row(
            index,
            segment_index,
            source,
            segment,
            identity.name,
            "解锁前证据",
            portal_row=candidate,
            attempt=1,
            recovery=unlocked_record_note(candidate),
            remark=reason,
            message="已唯一定位日期重叠的旧锁班，结果文件已保存",
        )
        self._persist_and_emit(evidence)

        unlock_message = self.client.unlock_record(candidate, "HTTP锁班冲突回退")
        unlocked = self._result_row(
            index,
            segment_index,
            source,
            segment,
            identity.name,
            "旧记录已解锁",
            portal_row=candidate,
            attempt=1,
            recovery=unlocked_record_note(candidate),
            remark=reason,
            message=unlock_message,
        )
        self._persist_and_emit(unlocked)

        retry_result = self.client.submit(body)
        retry_rows, retry_problem = self.client.attribute_submit_result(retry_result, segment, identity)
        if retry_rows:
            return self._complete_success(
                index,
                segment_index,
                source,
                segment,
                identity.name,
                retry_rows,
                2,
                "旧记录已解锁并重提一次",
                reason,
            )
        message = retry_problem
        if retry_result.conflict_rows:
            message = "重提后仍冲突，未继续解锁其他记录"
        failed = self._result_row(
            index,
            segment_index,
            source,
            segment,
            identity.name,
            "重提失败",
            portal_row=retry_result.conflict_rows[0] if retry_result.conflict_rows else None,
            attempt=2,
            recovery="已完成一次冲突回退",
            remark=reason,
            message=message,
        )
        self._persist_and_emit(failed)
        return False

    def run(self, records: list[dict[str, object]]) -> dict[str, int | bool]:
        summary: dict[str, int | bool] = {
            "total": len(records),
            "completed": 0,
            "success": 0,
            "failed": 0,
            "stopped": False,
        }
        self.emit({"type": "progress", **summary, "current": ""})
        for index, record in enumerate(records, start=1):
            if self.stop_event.is_set():
                summary["stopped"] = True
                break
            current = f"{record.get('员工号', '')} {record.get('姓名', '') or ''}".strip()
            self.emit({"type": "progress", **summary, "current": current})
            record_success = True
            try:
                identity = self.client.validate_employee(str(record.get("员工号", "")))
                expected_name = normalize_text(record.get("姓名"))
                if expected_name and expected_name != normalize_text(identity.name):
                    self._log("warning", f"{record.get('员工号')} 输入姓名与门户姓名不一致，按门户身份提交")
                segments, routing_problem = self._segments(record)
                if routing_problem or not segments:
                    raise PortalError(routing_problem or "智能路由没有生成可提交片段")
                for segment_index, segment in enumerate(segments, start=1):
                    if self.stop_event.is_set():
                        summary["stopped"] = True
                        record_success = False
                        break
                    if not self._submit_segment(index, segment_index, record, segment, identity):
                        record_success = False
            except PortalSessionExpired:
                raise
            except Exception as error:
                record_success = False
                event = self._result_row(
                    index,
                    0,
                    record,
                    record,
                    "",
                    "失败",
                    message=str(error),
                    remark=normalize_text(record.get("备注")) or self.common_reason,
                )
                self._persist_and_emit(event)
                self._log("error", f"{current} 处理失败：{error}")
            summary["completed"] = int(summary["completed"]) + 1
            key = "success" if record_success else "failed"
            summary[key] = int(summary[key]) + 1
            self.emit({"type": "progress", **summary, "current": ""})
        return summary
