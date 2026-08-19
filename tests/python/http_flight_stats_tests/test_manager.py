from __future__ import annotations

import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path

from .common import APP_ROOT  # noqa: F401
from http_flight_stats.manager import RunManager
from http_flight_stats.models import InputPayload, QueryRecord, TableResult


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
            "cookieNames": ["JSESSIONID", "iebJSid"],
            "verifiedAt": datetime.now().isoformat(timespec="seconds"),
        }

    def require_credentials(self) -> None:
        if not self.verified:
            raise RuntimeError("请先验证登录凭据")

    def query(self, record: QueryRecord) -> TableResult:
        time.sleep(0.01)
        return TableResult(
            headers=["员工号", "姓名", "飞行时间", "飞行经历", "左座经历", "起落总数"],
            values={
                "员工号": record.employee_id,
                "姓名": record.name,
                "飞行时间": "12:30",
                "飞行经历": "10:20",
                "左座经历": "8:10",
                "起落总数": "4",
            },
        )

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
    def test_staged_flow_keeps_credentials_private_and_writes_final_files(self) -> None:
        secret = "Cookie: JSESSIONID=secret-one; iebJSid=secret-two"
        payload = InputPayload(
            input_mode="paste",
            pasted_text=(
                "100001 测试甲 2025-01-01 2025-12-31\n"
                "100002 测试乙 2025-01-01 2025-12-31"
            ),
            scope=["flight_time"],
        )
        with tempfile.TemporaryDirectory() as directory:
            client = FakePortalClient()
            manager = RunManager(Path(directory), client=client)  # type: ignore[arg-type]

            verified = manager.verify_credentials(secret)
            self.assertTrue(verified["session"]["verified"])
            self.assertNotIn("secret-one", str(verified))
            self.assertNotIn("secret-two", str(verified))

            checked = manager.check_data(payload)
            self.assertEqual(checked["checks"]["data"]["validCount"], 2)
            running = manager.run(payload)
            self.assertEqual(running["phase"], "running")
            self.assertFalse(running["downloads"]["original"])

            finished = wait_until_finished(manager)

            self.assertEqual(finished["phase"], "completed")
            self.assertEqual(finished["progress"]["success"], 2)
            self.assertEqual(len(finished["results"]), 2)
            self.assertTrue(finished["downloads"]["original"])
            self.assertTrue(finished["downloads"]["stripped"])
            self.assertTrue(finished["session"]["verified"])
            self.assertTrue(manager.download_path("original").is_file())
            self.assertTrue(manager.download_path("stripped").is_file())
            manager.shutdown()
            self.assertTrue(client.closed)

    def test_agent_start_runs_full_chain(self) -> None:
        payload = InputPayload(
            input_mode="paste",
            pasted_text="100003 测试丙 2025-01-01 2025-12-31",
            scope="all",
        )
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), client=FakePortalClient())  # type: ignore[arg-type]

            state = manager.start("Cookie: fake", payload)
            self.assertEqual(state["phase"], "running")
            finished = wait_until_finished(manager)

            self.assertEqual(finished["phase"], "completed")
            self.assertEqual(finished["progress"]["success"], 1)
            manager.shutdown()


if __name__ == "__main__":
    unittest.main()
