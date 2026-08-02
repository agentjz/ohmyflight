from __future__ import annotations

import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path

import start_index


class StartIndexServerTests(unittest.TestCase):
    def test_default_port_is_4567(self) -> None:
        self.assertEqual(start_index.PORT, 4567)

    def test_serves_index(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text("ready", encoding="utf-8")
            server = start_index.create_server(root, 0)
            self.addCleanup(server.server_close)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(thread.join, 5)
            self.addCleanup(server.shutdown)

            actual_port = server.server_address[1]
            with urllib.request.urlopen(
                f"http://127.0.0.1:{actual_port}/index.html",
                timeout=5,
            ) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.read(), b"ready")


if __name__ == "__main__":
    unittest.main()
