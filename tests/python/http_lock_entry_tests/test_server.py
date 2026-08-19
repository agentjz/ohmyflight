from __future__ import annotations

import json
import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path

from .common import APP_DIR  # noqa: F401
from http_lock_entry.server import create_server, payload_from_json


class RecordingManager:
    def __init__(self):
        self.calls = []

    def snapshot(self):
        return {"phase": "credentials_ready", "session": {"verified": True}}

    def verify_credentials(self, credential_text):
        self.calls.append(("verify", bool(credential_text)))
        return self.snapshot()

    def check_data(self, payload):
        self.calls.append(("check", payload.input_mode))
        return self.snapshot()

    def run(self, payload):
        self.calls.append(("run", payload.input_mode))
        return self.snapshot()

    def start(self, credential_text, payload):
        self.calls.append(("start", bool(credential_text), payload.input_mode))
        return self.snapshot()

    def stop(self):
        self.calls.append(("stop",))
        return self.snapshot()

    def download_path(self):
        return None

    def shutdown(self):
        return None


class HttpLockEntryServerTest(unittest.TestCase):
    def test_payload_carries_direct_approval_option(self):
        payload = payload_from_json({
            "inputMode": "paste",
            "pastedText": "900001\t测试甲\tBS_STUDY\t2026-10-08\t2026-10-08",
            "approveAfterSubmit": True,
        })
        self.assertTrue(payload.approve_after_submit)

    def test_loopback_server_exposes_manual_steps_and_agent_start(self):
        manager = RecordingManager()
        server = create_server(APP_DIR, "smart", 0, manager)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        host, port = server.server_address
        self.assertEqual(host, "127.0.0.1")

        def post(path, payload):
            request = urllib.request.Request(
                f"http://{host}:{port}{path}",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                return json.loads(response.read().decode("utf-8"))

        input_payload = {"inputMode": "paste", "pastedText": "900001\t测试甲\tBS_STUDY\t2026-10-08\t2026-10-08"}
        try:
            post("/api/session/verify", {"credentials": "JSESSIONID=a; iebJSid=b"})
            post("/api/check-data", input_payload)
            post("/api/run", input_payload)
            post("/api/start", {**input_payload, "credentials": "JSESSIONID=a; iebJSid=b"})
            self.assertEqual([call[0] for call in manager.calls], ["verify", "check", "run", "start"])
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()

    def test_status_response_never_contains_supplied_cookie(self):
        manager = RecordingManager()
        state = manager.snapshot()
        self.assertNotIn("JSESSIONID", json.dumps(state))
        self.assertNotIn("iebJSid", json.dumps(state))

    def test_source_workbench_serves_shared_theme_assets(self):
        manager = RecordingManager()
        server = create_server(APP_DIR, "original", 0, manager)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        host, port = server.server_address
        try:
            for path in ("/theme.css", "/theme.js", "/libs/bootstrap.min.css"):
                with urllib.request.urlopen(f"http://{host}:{port}{path}", timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertGreater(len(response.read()), 100)
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()


if __name__ == "__main__":
    unittest.main()
