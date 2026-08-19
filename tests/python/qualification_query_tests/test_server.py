from __future__ import annotations

import json
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path

from .common import APP_DIR  # noqa: F401
from .workers import staged_worker, waiting_worker
from qualification_query.server import RunManager, create_server


COOKIE = "iebJSid=session-a; JSESSIONID=session-b"


class QualificationServerTest(unittest.TestCase):
    def test_server_listens_on_loopback_and_serves_workbench(self):
        class IdleManager:
            def snapshot(self):
                return {"phase": "idle"}

            def download_path(self, _kind):
                return None

        server = create_server(APP_DIR, 0, IdleManager())
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        host, port = server.server_address
        try:
            self.assertEqual(host, "127.0.0.1")
            with urllib.request.urlopen(f"http://{host}:{port}/", timeout=5) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("技术等级运行资格查询助手（乞丐版）".encode("utf-8"), response.read())
            with urllib.request.urlopen(f"http://{host}:{port}/api/status", timeout=5) as response:
                self.assertIn(b'"phase": "idle"', response.read())
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()

    def test_prepare_and_run_are_separate_and_browser_is_reusable(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), worker_target=staged_worker)
            try:
                manager.prepare(COOKIE, "paste", pasted_text="000001 测试甲")
                self._wait_for(manager, "prepared")
                self.assertTrue(manager.snapshot()["canRun"])
                manager.run()
                self._wait_for(manager, "completed")
                completed = manager.snapshot()
                self.assertTrue(completed["canPrepare"])
                process_id = manager._process.pid

                manager.prepare("", "paste", pasted_text="000002 测试乙")
                self._wait_for(manager, "prepared")
                self.assertEqual(manager._process.pid, process_id)
                manager.stop()
            finally:
                manager.shutdown()

    def test_status_never_contains_cookie_values(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), worker_target=waiting_worker)
            try:
                state = manager.prepare(COOKIE, "paste", pasted_text="000001 测试甲")
                self.assertNotIn("session-a", json.dumps(state, ensure_ascii=False))
                self.assertNotIn("session-b", json.dumps(manager.snapshot(), ensure_ascii=False))
            finally:
                manager.shutdown()

    def test_http_exposes_staged_and_agent_endpoints(self):
        class RecordingManager:
            def __init__(self):
                self.calls = []

            def snapshot(self):
                return {"phase": "idle"}

            def prepare(self, credentials, **_payload):
                self.calls.append(("prepare", bool(credentials)))
                return {"phase": "starting"}

            def start(self, credentials, **_payload):
                self.calls.append(("start", bool(credentials)))
                return {"phase": "starting"}

            def check_data(self):
                self.calls.append(("check-data", False))
                return {"phase": "data_checked"}

            def run(self):
                self.calls.append(("run", False))
                return {"phase": "running"}

            def stop(self):
                return {"phase": "terminated"}

            def download_path(self, _kind):
                return None

        manager = RecordingManager()
        server = create_server(APP_DIR, 0, manager)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        host, port = server.server_address
        try:
            payload = {"credentials": COOKIE, "inputMode": "paste", "pastedText": "000001 测试甲"}
            self._post(host, port, "/api/prepare", payload)
            self._post(host, port, "/api/check-data", {})
            self._post(host, port, "/api/run", {})
            self._post(host, port, "/api/start", payload)
            self.assertEqual(manager.calls, [("prepare", True), ("check-data", False), ("run", False), ("start", True)])
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()

    @staticmethod
    def _wait_for(manager, phase):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if manager.snapshot()["phase"] == phase:
                return
            time.sleep(0.05)
        raise AssertionError(f"未进入状态: {phase}")

    @staticmethod
    def _post(host, port, path, payload):
        request = urllib.request.Request(
            f"http://{host}:{port}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
