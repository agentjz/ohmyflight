from __future__ import annotations

import unittest

from .common import APP_ROOT  # noqa: F401
from http_flight_stats.credentials import credential_summary, parse_credentials


class CredentialTests(unittest.TestCase):
    def test_extracts_only_required_cookies_from_curl(self) -> None:
        source = (
            "curl 'https://ieb.example.test/index' "
            "-H 'Cookie: tracking=ignored; JSESSIONID=session-value; "
            "iebJSid=browser-value; analytics=ignored'"
        )

        cookies = parse_credentials(source)

        self.assertEqual(
            cookies,
            {"JSESSIONID": "session-value", "iebJSid": "browser-value"},
        )
        summary = credential_summary(cookies)
        self.assertEqual(summary["cookieCount"], 2)
        self.assertNotIn("session-value", str(summary))
        self.assertNotIn("browser-value", str(summary))

    def test_rejects_incomplete_credentials(self) -> None:
        with self.assertRaisesRegex(ValueError, "iebJSid"):
            parse_credentials("Cookie: JSESSIONID=session-value")


if __name__ == "__main__":
    unittest.main()

