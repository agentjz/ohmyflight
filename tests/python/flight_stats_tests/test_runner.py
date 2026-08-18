from __future__ import annotations

import tempfile
import unittest
from datetime import date
from pathlib import Path

from .common import APP_DIR  # noqa: F401; ensures the app modules are importable
from flight_stats.exporter import ResultExporter
from flight_stats.input_data import QueryRecord
from flight_stats.portal import TableResult
from flight_stats.runner import run_records


class FlightStatsRunnerTest(unittest.TestCase):
    def test_single_record_failure_does_not_stop_following_records(self):
        records = [
            QueryRecord("111111", "第一人", date(2026, 8, 1), date(2026, 8, 2), "第1行"),
            QueryRecord("222222", "第二人", date(2026, 8, 1), date(2026, 8, 2), "第2行"),
        ]

        class FakePortal:
            def query(self, record, clear_first=False):
                if record.employee_id == "111111":
                    raise RuntimeError("样例失败")
                return TableResult(
                    headers=["员工号", "姓名", "飞行时间"],
                    values={"员工号": record.employee_id, "姓名": record.name, "飞行时间": "10:30"},
                )

        with tempfile.TemporaryDirectory() as directory:
            exporter = ResultExporter(Path(directory), "continue-run")
            exporter.initialize(records, [])
            events = []

            summary = run_records(records, FakePortal(), exporter, events.append)

            self.assertEqual(summary.success, 1)
            self.assertEqual(summary.failed, 1)
            record_events = [event for event in events if event.get("type") == "record_result"]
            self.assertEqual(record_events[0]["status"], "失败")
            self.assertEqual(record_events[1]["status"], "成功")
            self.assertEqual(record_events[1]["values"]["飞行时间"], "10:30")

            workbook = __import__("openpyxl").load_workbook(exporter.paths.original, data_only=True)
            sheet = workbook["查询结果"]
            headers = [cell.value for cell in sheet[1]]
            status_column = headers.index("查询状态") + 1
            self.assertEqual(sheet.cell(2, status_column).value, "失败")
            self.assertEqual(sheet.cell(3, status_column).value, "成功")
            workbook.close()


if __name__ == "__main__":
    unittest.main()
