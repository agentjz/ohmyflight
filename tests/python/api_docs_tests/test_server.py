from __future__ import annotations

import json
import threading
import unittest
import urllib.request

from .common import APP_ROOT, CATALOG_ROOT
from api_docs.catalog import ApiCatalog
from api_docs.server import create_server


class StubExecutor:
    def __init__(self) -> None:
        self.catalog = ApiCatalog(CATALOG_ROOT)
        self.ready = False
        self.calls: list[tuple[object, ...]] = []

    def session_status(self) -> dict[str, object]:
        return {"ready": self.ready, "cookieNames": ["JSESSIONID", "iebJSid"] if self.ready else [], "cookieCount": 2 if self.ready else 0}

    def load_credentials(self, source: str) -> dict[str, object]:
        self.calls.append(("session", bool(source)))
        self.ready = True
        return {
            **self.session_status(),
            "credentials": "JSESSIONID=session-value; iebJSid=browser-value",
        }

    def clear_credentials(self) -> None:
        self.ready = False

    def load_options(self, source: str) -> list[dict[str, str]]:
        self.calls.append(("options", source))
        return [{"value": "TEST", "label": "测试类型"}]

    def execute(self, endpoint_id: str, parameters: dict[str, object]) -> dict[str, object]:
        self.calls.append(("execute", endpoint_id, parameters))
        return {
            "status": 200,
            "body": "ok",
            "headers": {},
            "elapsedMilliseconds": 1,
            "data": {"tables": [], "summary": {}},
        }


class ServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.executor = StubExecutor()
        self.server = create_server(APP_ROOT, 0, self.executor)  # type: ignore[arg-type]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_address[1]}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.thread.join(timeout=5)
        self.server.server_close()

    def request(self, path: str, method: str = "GET", payload: object | None = None) -> dict[str, object]:
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.base_url + path,
            data=data,
            headers={"Content-Type": "application/json"} if data is not None else {},
            method=method,
        )
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))

    def test_loopback_routes_share_catalog_and_only_session_load_returns_credentials(self) -> None:
        health = self.request("/api/health")
        self.assertTrue(health["available"])
        catalog = self.request("/api/catalog")
        self.assertEqual([module["id"] for module in catalog["modules"]], ["flight-stats", "lock-entry"])
        session = self.request("/api/session", "POST", {"credentials": "secret-cookie-text"})
        self.assertTrue(session["ready"])
        self.assertNotIn("secret-cookie-text", json.dumps(session))
        self.assertEqual(session["credentials"], "JSESSIONID=session-value; iebJSid=browser-value")
        active_health = self.request("/api/health")
        self.assertNotIn("session-value", json.dumps(active_health))
        self.assertNotIn("browser-value", json.dumps(active_health))
        options = self.request("/api/options/lock-types")
        self.assertEqual(options["options"][0]["value"], "TEST")
        result = self.request("/api/execute", "POST", {"endpointId": "flight-stats.query", "parameters": {}})
        self.assertEqual(result["body"], "ok")
        cleared = self.request("/api/session", "DELETE")
        self.assertFalse(cleared["ready"])
        self.assertNotIn("credentials", cleared)

    def test_source_server_serves_page_catalog_and_shared_theme(self) -> None:
        for path in (
            "/",
            "/app.js",
            "/catalog-view.mjs",
            "/parameter-form.mjs",
            "/response-view.mjs",
            "/catalog/index.json",
            "/theme.css",
            "/theme.js",
        ):
            with urllib.request.urlopen(self.base_url + path, timeout=5) as response:
                self.assertEqual(response.status, 200)
                self.assertGreater(len(response.read()), 20)
                if path == "/app.js":
                    self.assertIn("javascript", response.headers.get_content_type())


if __name__ == "__main__":
    unittest.main()
