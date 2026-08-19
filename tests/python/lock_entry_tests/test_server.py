from __future__ import annotations

import json
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path

from .common import APP_DIR  # noqa: F401; ensures the app modules are importable
from .workers import staged_worker, waiting_worker
from lock_entry.server import RunManager, create_server


class LockEntryServerTest(unittest.TestCase):
    def wait_for_phase(self, manager, expected):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            state = manager.snapshot()
            if state["phase"] == expected:
                return state
            time.sleep(0.05)
        self.fail(f"未进入阶段 {expected}: {manager.snapshot()}")

    def test_server_listens_on_loopback_and_exposes_fixed_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), "smart", worker_target=waiting_worker)
            server = create_server(APP_DIR, "smart", 0, manager)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                host, port = server.server_address
                self.assertEqual(host, "127.0.0.1")
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertIn("锁班乞丐".encode("utf-8"), response.read())
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/status", timeout=5) as response:
                    state = json.loads(response.read().decode("utf-8"))
                    self.assertEqual(state["mode"], "smart")
                    self.assertEqual(state["modeLabel"], "智能串行")
            finally:
                server.shutdown()
                thread.join(timeout=5)
                manager.shutdown()
                server.server_close()

    def test_staged_run_keeps_worker_and_accepts_next_batch(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), "original", worker_target=staged_worker)
            try:
                manager.prepare("paste", pasted_text="123456 示例人员 BS_STUDY 2026-10-01")
                self.wait_for_phase(manager, "prepared")
                checked = manager.check_data()
                self.assertTrue(checked["checks"]["data"]["ok"])
                self.assertTrue(checked["canRun"])

                manager.run()
                self.wait_for_phase(manager, "completed")
                process_id = manager._process.pid
                self.assertTrue(manager.snapshot()["canReuseBrowser"])

                manager.prepare("paste", pasted_text="654321 示例人员 BS_STUDY 2026-10-02")
                self.assertEqual(manager._process.pid, process_id)
                manager.run()
                self.wait_for_phase(manager, "completed")
                manager.stop()
            finally:
                manager.shutdown()

    def test_invalid_health_check_does_not_block_manual_run(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), "smart", worker_target=staged_worker)
            try:
                manager.prepare("paste", pasted_text="无效数据")
                self.wait_for_phase(manager, "prepared")
                checked = manager.check_data()
                self.assertFalse(checked["checks"]["data"]["ok"])
                self.assertTrue(checked["canRun"])
                started = manager.run()
                self.assertIn(started["phase"], {"running", "completed"})
            finally:
                manager.shutdown()

    def test_agent_start_runs_full_chain_and_stop_closes_worker(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), "original", worker_target=staged_worker)
            try:
                manager.start(input_mode="paste", pasted_text="123456 示例人员 BS_STUDY 2026-10-01")
                self.wait_for_phase(manager, "completed")
                self.assertTrue(manager.snapshot()["canStop"])
                stopped = manager.stop()
                self.assertEqual(stopped["phase"], "terminated")
                self.assertFalse(manager.snapshot()["canStop"])
            finally:
                manager.shutdown()

    def test_http_exposes_staged_and_agent_endpoints(self):
        class RecordingManager:
            def __init__(self):
                self.calls = []

            def snapshot(self):
                return {"phase": "idle"}

            def prepare(self, **_payload):
                self.calls.append("prepare")
                return {"phase": "starting"}

            def start(self, **_payload):
                self.calls.append("start")
                return {"phase": "starting"}

            def check_data(self):
                self.calls.append("check-data")
                return {"phase": "data_checked"}

            def run(self):
                self.calls.append("run")
                return {"phase": "running"}

            def stop(self):
                self.calls.append("stop")
                return {"phase": "terminated"}

            def download_path(self):
                return None

        manager = RecordingManager()
        server = create_server(APP_DIR, "original", 0, manager)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        host, port = server.server_address

        def post(path, payload=None):
            request = urllib.request.Request(
                f"http://{host}:{port}{path}",
                data=json.dumps(payload or {}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                return json.loads(response.read().decode("utf-8"))

        try:
            payload = {"inputMode": "paste", "pastedText": "123456 示例人员 BS_STUDY 2026-10-01"}
            post("/api/prepare", payload)
            post("/api/check-data")
            post("/api/run")
            post("/api/start", payload)
            self.assertEqual(manager.calls, ["prepare", "check-data", "run", "start"])
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()


if __name__ == "__main__":
    unittest.main()
