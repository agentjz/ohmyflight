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
from flight_stats.server import RunManager, create_server


class FlightStatsServerTest(unittest.TestCase):
    def test_server_listens_on_loopback_and_serves_status(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), worker_target=waiting_worker)
            server = create_server(APP_DIR, 0, manager)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                host, port = server.server_address
                self.assertEqual(host, "127.0.0.1")
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertIn("飞行经历查询（乞丐版）".encode("utf-8"), response.read())
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/status", timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertIn(b'"phase": "idle"', response.read())
            finally:
                server.shutdown()
                thread.join(timeout=5)
                manager.shutdown()
                server.server_close()

    def test_manager_rejects_duplicate_start_and_stops_worker(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), worker_target=waiting_worker)
            try:
                manager.start("paste", pasted_text="000001 测试甲 2025/2/27")
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    if manager.snapshot()["phase"] == "waiting_login":
                        break
                    time.sleep(0.05)

                with self.assertRaisesRegex(RuntimeError, "已有查询正在运行"):
                    manager.start("paste", pasted_text="000001 测试甲 2025/2/27")

                stopped = manager.stop()
                self.assertEqual(stopped["phase"], "terminated")
                self.assertTrue(manager.snapshot()["canStart"])
                self.assertFalse(manager.snapshot()["canStop"])
            finally:
                manager.shutdown()

    def test_completed_batch_keeps_browser_and_accepts_next_input(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), worker_target=staged_worker)
            try:
                manager.prepare("paste", pasted_text="000001 测试甲 2025/2/27")
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    if manager.snapshot()["phase"] == "prepared":
                        break
                    time.sleep(0.05)

                manager.run()
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    if manager.snapshot()["phase"] == "completed":
                        break
                    time.sleep(0.05)
                self.assertEqual(manager.snapshot()["phase"], "completed")
                self.assertTrue(manager.snapshot()["canPrepare"])
                process_id = manager._process.pid

                next_state = manager.prepare("paste", pasted_text="000002 测试乙 2025/3/1")
                self.assertEqual(next_state["phase"], "prepared")
                self.assertEqual(manager._process.pid, process_id)
                manager.run()
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    if manager.snapshot()["phase"] == "completed":
                        break
                    time.sleep(0.05)
                self.assertEqual(manager.snapshot()["phase"], "completed")
                manager.stop()
            finally:
                manager.shutdown()

    def test_data_check_reports_invalid_input_without_forcing_a_block(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), worker_target=staged_worker)
            try:
                manager.prepare("paste", pasted_text="无效数据")
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    if manager.snapshot()["phase"] == "prepared":
                        break
                    time.sleep(0.05)

                checked = manager.check_data()
                self.assertFalse(checked["checks"]["data"]["ok"])
                self.assertTrue(checked["canRun"])
                started = manager.run()
                self.assertIn(started["phase"], {"running", "completed"})
            finally:
                manager.shutdown()

    def test_start_keeps_agent_full_chain_behavior(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = RunManager(Path(directory), worker_target=staged_worker)
            try:
                manager.start("paste", pasted_text="000001 测试甲 2025/2/27")
                deadline = time.monotonic() + 5
                while time.monotonic() < deadline:
                    if manager.snapshot()["phase"] == "completed":
                        break
                    time.sleep(0.05)
                self.assertEqual(manager.snapshot()["phase"], "completed")
                self.assertTrue(manager.snapshot()["canPrepare"])
                manager.stop()
            finally:
                manager.shutdown()

    def test_http_exposes_staged_and_agent_full_chain_endpoints(self):
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

            def download_path(self, _kind):
                return None

        manager = RecordingManager()
        server = create_server(APP_DIR, 0, manager)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        host, port = server.server_address

        def post(path, payload=None):
            body = json.dumps(payload or {}).encode("utf-8")
            request = urllib.request.Request(
                f"http://{host}:{port}{path}",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                return json.loads(response.read().decode("utf-8"))

        try:
            payload = {"inputMode": "paste", "pastedText": "000001 测试甲 2025/2/27"}
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
