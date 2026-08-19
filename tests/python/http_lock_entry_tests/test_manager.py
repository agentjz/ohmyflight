from __future__ import annotations

import json
import tempfile
import time
import unittest
from pathlib import Path

from .common import APP_DIR, ENTRY_HTML  # noqa: F401
from http_lock_entry.manager import RunManager
from http_lock_entry.metadata import parse_portal_metadata
from http_lock_entry.models import InputPayload


class FakeCookieJar:
    def clear(self):
        return None


class FakeSession:
    def __init__(self):
        self.cookies = FakeCookieJar()

    def close(self):
        return None


class FakeClient:
    def __init__(self):
        self.metadata = None
        self.verified_at = ""
        self.session = FakeSession()

    def load_credentials(self, _source):
        self.metadata = parse_portal_metadata(ENTRY_HTML)
        self.verified_at = "2026-08-19 10:00:00"
        return self.metadata

    def require_metadata(self):
        if self.metadata is None:
            raise RuntimeError("missing metadata")
        return self.metadata


class FakeRunner:
    def __init__(self, _client, _store, _mode, _recovery, _reason, stop_event, emit):
        self.stop_event = stop_event
        self.emit = emit

    def run(self, records):
        self.emit({"type": "progress", "total": len(records), "completed": 1, "success": 1, "failed": 0, "current": ""})
        self.emit({
            "type": "record_result", "index": 1, "employeeId": records[0]["员工号"],
            "name": "测试甲", "status": "成功", "remark": "批量测试",
        })
        return {"total": len(records), "completed": 1, "success": 1, "failed": 0, "stopped": False}


class HttpLockEntryManagerTest(unittest.TestCase):
    def wait_for_completion(self, manager):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            state = manager.snapshot()
            if state["phase"] == "completed":
                return state
            time.sleep(0.02)
        self.fail(f"manager did not complete: {manager.snapshot()}")

    def payload(self):
        return InputPayload(
            input_mode="paste",
            pasted_text=(
                "900001\t测试甲\tBS_STUDY\t2026-10-08\t2026-10-08\n"
                "无效数据"
            ),
            common_reason="批量测试",
        )

    def test_health_check_only_reports_and_completed_batch_keeps_session(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(
                Path(directory),
                "original",
                client=FakeClient(),
                runner_factory=FakeRunner,
            )
            try:
                verified = manager.verify_credentials("JSESSIONID=secret-a; iebJSid=secret-b")
                self.assertTrue(verified["session"]["verified"])
                self.assertNotIn("secret-a", json.dumps(verified, ensure_ascii=False))
                checked = manager.check_data(self.payload())
                self.assertEqual(checked["checks"]["data"]["validCount"], 1)
                self.assertEqual(checked["checks"]["data"]["invalidCount"], 1)
                self.assertTrue(checked["canRun"])

                manager.run(self.payload())
                completed = self.wait_for_completion(manager)
                self.assertTrue(completed["session"]["verified"])
                self.assertTrue(completed["canRun"])
                self.assertEqual(completed["results"][0]["status"], "成功")
                self.assertTrue(manager.download_path().is_file())
            finally:
                manager.shutdown()


if __name__ == "__main__":
    unittest.main()
