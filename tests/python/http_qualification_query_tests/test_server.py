from __future__ import annotations

import json
import threading
import unittest
import urllib.request

from .common import APP_ROOT  # noqa: F401
from http_qualification_query.server import create_server


class RecordingManager:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def snapshot(self) -> dict[str, str]:
        return {"phase": "waiting_credentials"}

    def verify_credentials(self, _credentials: str) -> dict[str, str]:
        self.calls.append("verify")
        return {"phase": "credentials_ready"}

    def check_data(self, _payload: object) -> dict[str, str]:
        self.calls.append("check")
        return {"phase": "data_checked"}

    def run(self, _payload: object) -> dict[str, str]:
        self.calls.append("run")
        return {"phase": "running"}

    def start(self, _credentials: str, _payload: object) -> dict[str, str]:
        self.calls.append("start")
        return {"phase": "running"}

    def stop(self) -> dict[str, str]:
        self.calls.append("stop")
        return {"phase": "terminated"}

    def download_path(self, _kind: str) -> None:
        return None


class ServerTests(unittest.TestCase):
    def test_loopback_server_exposes_staged_and_agent_endpoints(self) -> None:
        manager = RecordingManager()
        server = create_server(APP_ROOT, 0, manager)  # type: ignore[arg-type]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        host, port = server.server_address
        try:
            self.assertEqual(host, "127.0.0.1")
            with urllib.request.urlopen(f"http://{host}:{port}/", timeout=5) as response:
                self.assertIn("技术等级运行资格查询助手（皇帝版）".encode("utf-8"), response.read())
            payload = {"credentials": "Cookie: fake", "inputMode": "paste", "pastedText": "900001 测试甲"}
            self._post(host, port, "/api/session/verify", payload)
            self._post(host, port, "/api/check-data", payload)
            self._post(host, port, "/api/run", payload)
            self._post(host, port, "/api/stop", {})
            self._post(host, port, "/api/start", payload)
            self.assertEqual(manager.calls, ["verify", "check", "run", "stop", "start"])
        finally:
            server.shutdown()
            thread.join(timeout=5)
            server.server_close()

    @staticmethod
    def _post(host: str, port: int, path: str, payload: dict[str, object]) -> dict[str, object]:
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
