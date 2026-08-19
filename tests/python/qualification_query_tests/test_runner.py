from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from .common import APP_DIR  # noqa: F401
from qualification_query.exporter import ResultExporter
from qualification_query.models import QueryRecord, QueryResult
from qualification_query.runner import run_records


class QualificationRunnerTest(unittest.TestCase):
    def test_failure_is_reported_and_next_person_still_runs(self):
        records = [
            QueryRecord(2, "000001", "测试甲", "第2行"),
            QueryRecord(3, "000002", "测试乙", "第3行"),
        ]

        class Portal:
            def query(self, record):
                if record.employee_id == "000001":
                    raise RuntimeError("样例失败")
                return QueryResult(record.name, [], [{"类型": "资格", "运行资格": "样例"}])

        with tempfile.TemporaryDirectory() as directory:
            exporter = ResultExporter(Path(directory), "runner-run")
            exporter.initialize(records, [])
            events = []
            summary = run_records(records, Portal(), exporter, events.append)

            self.assertEqual((summary.success, summary.failed), (1, 1))
            results = [event for event in events if event.get("type") == "record_result"]
            self.assertEqual([item["status"] for item in results], ["失败", "成功"])
            self.assertEqual(results[1]["operationCount"], 1)


if __name__ == "__main__":
    unittest.main()

