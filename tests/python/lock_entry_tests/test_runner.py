from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from .common import APP_DIR  # noqa: F401; ensures the app modules are importable
from lock_entry import workbench_runner
from lock_entry.exporter import create_result_excel
from lock_entry.smart_exporter import append_result_excel as append_smart_result
from lock_entry.smart_exporter import create_result_excel as create_smart_result


class LockEntryRunnerTest(unittest.TestCase):
    def test_original_failure_does_not_stop_following_record(self):
        records = [
            {"员工号": "111111", "姓名": "示例一", "请假类型": "BS_STUDY", "开始日期": "2026-10-01", "结束日期": "2026-10-01"},
            {"员工号": "222222", "姓名": "示例二", "请假类型": "BS_STUDY", "开始日期": "2026-10-02", "结束日期": "2026-10-02"},
        ]
        original_fill = workbench_runner.fill_original_form
        original_submit = workbench_runner.submit_original_result
        original_back = workbench_runner.original_go_back_to_form
        try:
            workbench_runner.fill_original_form = lambda *_args, **_kwargs: None

            def submit(_page, record):
                if record["员工号"] == "111111":
                    raise RuntimeError("测试异常")
                return "成功", {"员工号": "222222", "姓名": "示例二", "锁班结果": "待审批"}, ""

            workbench_runner.submit_original_result = submit
            workbench_runner.original_go_back_to_form = lambda _page: None
            with tempfile.TemporaryDirectory() as directory:
                output = create_result_excel("runner", directory)
                events = []
                summary = workbench_runner.run_original_records(records, object(), output, "", events.append)
                self.assertEqual(summary.success, 1)
                self.assertEqual(summary.failed, 1)
                results = [event for event in events if event.get("type") == "record_result"]
                self.assertEqual([result["status"] for result in results], ["异常", "成功"])
        finally:
            workbench_runner.fill_original_form = original_fill
            workbench_runner.submit_original_result = original_submit
            workbench_runner.original_go_back_to_form = original_back

    def test_smart_runner_emits_each_persisted_segment(self):
        record = {
            "员工号": "111111",
            "姓名": "示例人员",
            "请假类型": "ALV_FD",
            "开始日期": "2026-10-01",
            "结束日期": "2026-10-02",
        }
        original_process = workbench_runner.process_smart_record
        try:
            def process(_page, current, sequence, output, _reason, _recovery):
                quotas = {"ALV_FD": 1, "RECU_LVE": 1}
                first = {**current, "请假类型": "ALV_FD", "开始日期": "2026-10-01", "结束日期": "2026-10-01", "计划天数": 1}
                second = {**current, "请假类型": "RECU_LVE", "开始日期": "2026-10-02", "结束日期": "2026-10-02", "计划天数": 1}
                append_smart_result(output, sequence, 1, current, first, quotas, "成功", {"锁班结果": "待审批"})
                append_smart_result(output, sequence, 2, current, second, quotas, "成功", {"锁班结果": "待审批"})
                return True, ""

            workbench_runner.process_smart_record = process
            with tempfile.TemporaryDirectory() as directory:
                output = create_smart_result("smart-runner", directory)
                events = []
                summary = workbench_runner.run_smart_records(
                    [record], object(), output, "", False, events.append
                )
                self.assertEqual(summary.success, 1)
                results = [event for event in events if event.get("type") == "record_result"]
                self.assertEqual([result["segmentIndex"] for result in results], [1, 2])
                self.assertEqual(results[1]["actualType"], "健康疗养")
        finally:
            workbench_runner.process_smart_record = original_process


if __name__ == "__main__":
    unittest.main()
