from __future__ import annotations

import threading
import unittest

from .common import APP_DIR, CONFLICT_HTML, ENTRY_HTML, SUCCESS_HTML  # noqa: F401
from http_lock_entry.metadata import parse_portal_metadata
from http_lock_entry.models import EmployeeIdentity
from http_lock_entry.portal_client import PortalClient
from http_lock_entry.runner import BatchRunner


class RecordingStore:
    def __init__(self):
        self.rows = []
        self.path = "result.xlsx"

    def append(self, row):
        self.rows.append(dict(row))


class RecoveryClient:
    def __init__(self, second_html=SUCCESS_HTML, candidates=None):
        self.metadata = parse_portal_metadata(ENTRY_HTML)
        self.parser = PortalClient()
        self.responses = [
            self.parser.parse_submit_result(CONFLICT_HTML),
            self.parser.parse_submit_result(second_html),
        ]
        self.candidates = candidates if candidates is not None else [{
            "记录ID": "record-1", "状态": "已锁", "员工号": "900001", "姓名": "测试甲",
            "开始日期": "2026-10-08 08:00:00", "结束日期": "2026-10-08 20:00:00",
            "锁班类型": "旧任务", "锁班名称": "旧任务", "锁班原因": "旧备注", "录入时间": "2026-09-01",
        }]
        self.calls = []

    def validate_employee(self, employee_id):
        self.calls.append(("validate", employee_id))
        return EmployeeIdentity(employee_id, "测试甲", "测试部门")

    def require_metadata(self):
        return self.metadata

    def resolve_reason(self, record, common_reason):
        return record.get("备注") or common_reason or "默认原因"

    def build_submit_data(self, *_args):
        return [("payload", "same-body")]

    def submit(self, body):
        self.calls.append(("submit", list(body)))
        return self.responses.pop(0)

    def attribute_submit_result(self, result, _record, _identity):
        if result.conflict_rows:
            return [], "存在冲突"
        return result.result_rows, "" if result.result_rows else "没有结果"

    def attribute_conflict_result(self, result, _record, _identity):
        return (result.conflict_rows, "") if result.conflict_rows else ([], "没有冲突结果")

    def query_records(self, employee_id, status):
        self.calls.append(("query", employee_id, status))
        return list(self.candidates)

    def unlock_record(self, row, reason):
        self.calls.append(("unlock", row["记录ID"], reason))
        return "解锁成功"

    def approve_records(self, rows, reason):
        self.calls.append(("approve", [row["记录ID"] for row in rows], reason))
        return "通过成功"


class HttpLockEntryRunnerTest(unittest.TestCase):
    def record(self):
        return {
            "员工号": "900001", "姓名": "测试甲", "请假类型": "BS_STUDY",
            "开始日期": "2026-10-08", "结束日期": "2026-10-08", "时间模式": 1,
            "开始时间": "08:17", "结束时间": "18:43", "月份": "", "日期列表": [],
            "备注": "批量测试", "来源行": 2,
        }

    def test_conflict_evidence_is_saved_before_unique_unlock_and_only_one_retry(self):
        client = RecoveryClient()
        store = RecordingStore()
        events = []
        runner = BatchRunner(client, store, "original", True, "", threading.Event(), events.append)
        summary = runner.run([self.record()])

        self.assertEqual(summary["success"], 1)
        self.assertEqual([call[0] for call in client.calls].count("submit"), 2)
        unlock_call = next(index for index, call in enumerate(client.calls) if call[0] == "unlock")
        self.assertTrue(any(row["status"] == "解锁前证据" for row in store.rows))
        evidence_event = next(index for index, event in enumerate(events) if event.get("status") == "解锁前证据")
        unlock_event = next(index for index, event in enumerate(events) if event.get("status") == "旧记录已解锁")
        self.assertLess(evidence_event, unlock_event)
        self.assertGreater(unlock_call, 0)
        self.assertEqual(store.rows[-1]["attempt"], 2)

    def test_non_unique_conflict_never_unlocks(self):
        duplicate = {
            "记录ID": "record-2", "状态": "已锁", "员工号": "900001", "姓名": "测试甲",
            "开始日期": "2026-10-08 07:00:00", "结束日期": "2026-10-08 21:00:00",
            "锁班类型": "另一个旧任务", "录入时间": "2026-09-02",
        }
        client = RecoveryClient(candidates=RecoveryClient().candidates + [duplicate])
        store = RecordingStore()
        runner = BatchRunner(client, store, "original", True, "", threading.Event(), lambda _event: None)
        summary = runner.run([self.record()])
        self.assertEqual(summary["failed"], 1)
        self.assertFalse(any(call[0] == "unlock" for call in client.calls))

    def test_records_are_submitted_in_input_order(self):
        client = RecoveryClient()
        client.responses = [client.parser.parse_submit_result(SUCCESS_HTML) for _index in range(3)]
        records = [
            {**self.record(), "员工号": employee_id, "来源行": index + 2}
            for index, employee_id in enumerate(("900001", "900002", "900003"))
        ]
        runner = BatchRunner(
            client,
            RecordingStore(),
            "original",
            False,
            "批量测试",
            threading.Event(),
            lambda _event: None,
        )
        summary = runner.run(records)
        validated = [call[1] for call in client.calls if call[0] == "validate"]
        self.assertEqual(validated, ["900001", "900002", "900003"])
        self.assertEqual(summary["success"], 3)

    def test_approve_after_submit_runs_serial_approval_and_reports_locked(self):
        client = RecoveryClient()
        client.responses = [client.parser.parse_submit_result(SUCCESS_HTML)]
        store = RecordingStore()
        runner = BatchRunner(
            client,
            store,
            "original",
            False,
            "",
            threading.Event(),
            lambda _event: None,
            True,
        )
        summary = runner.run([self.record()])
        self.assertEqual(summary["success"], 1)
        self.assertEqual([call[0] for call in client.calls], ["validate", "submit", "approve"])
        self.assertEqual(store.rows[-1]["status"], "已通过并锁班")



if __name__ == "__main__":
    unittest.main()
