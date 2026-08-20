from __future__ import annotations

import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path

from .common import APP_ROOT  # noqa: F401
from http_qualification_query.manager import RunManager
from http_qualification_query.models import InputPayload, QueryRecord, QueryResult


class FakePortalClient:
    def __init__(self) -> None:
        self.verified = False
        self.closed = False

    def load_credentials(self, source: str) -> dict[str, object]:
        if not source:
            raise ValueError("缺少凭据")
        self.verified = True
        return {
            "cookieCount": 2,
            "verifiedAt": datetime.now().isoformat(timespec="seconds"),
        }

    def require_credentials(self) -> None:
        if not self.verified:
            raise RuntimeError("请先验证登录凭据")

    def query(self, record: QueryRecord) -> QueryResult:
        time.sleep(0.01)
        if record.employee_id == "900001":
            raise RuntimeError("样例查询失败")
        return QueryResult(record.name, [{"#": "1", "技术等级": "机长"}], [{"类型": "航线"}])

    def clear_credentials(self) -> None:
        self.verified = False

    def close(self) -> None:
        self.closed = True


def wait_until_finished(manager: RunManager) -> dict[str, object]:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        state = manager.snapshot()
        if state["phase"] in {"completed", "failed", "terminated"}:
            return state
        time.sleep(0.02)
    raise AssertionError("批次没有按时结束")


class ManagerTests(unittest.TestCase):
    def test_health_check_does_not_block_valid_rows_and_failure_continues(self) -> None:
        payload = InputPayload(
            input_mode="paste",
            pasted_text="900001 测试甲\n无效行\n900002 测试乙",
        )
        with tempfile.TemporaryDirectory() as directory:
            client = FakePortalClient()
            manager = RunManager(Path(directory), client=client)  # type: ignore[arg-type]
            manager.verify_credentials("Cookie: fake")
            checked = manager.check_data(payload)

            self.assertEqual(checked["checks"]["data"]["validCount"], 2)
            self.assertEqual(checked["checks"]["data"]["invalidCount"], 1)
            self.assertTrue(checked["canRun"])

            manager.run(payload)
            finished = wait_until_finished(manager)
            self.assertEqual(finished["phase"], "completed")
            self.assertEqual(finished["progress"]["success"], 1)
            self.assertEqual(finished["progress"]["failed"], 1)
            self.assertEqual([item["status"] for item in finished["results"]], ["失败", "成功"])
            self.assertTrue(finished["downloads"]["excel"])
            self.assertTrue(finished["downloads"]["report"])
            self.assertTrue(finished["session"]["verified"])
            manager.shutdown()
            self.assertTrue(client.closed)

    def test_agent_start_runs_full_chain_without_returning_credentials(self) -> None:
        payload = InputPayload(input_mode="paste", pasted_text="900002 测试乙")
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), client=FakePortalClient())  # type: ignore[arg-type]
            state = manager.start("Cookie: secret-value", payload)
            self.assertEqual(state["phase"], "running")
            self.assertNotIn("secret-value", str(state))
            self.assertEqual(wait_until_finished(manager)["progress"]["success"], 1)
            manager.shutdown()


if __name__ == "__main__":
    unittest.main()

