from __future__ import annotations

import unittest

from .common import APP_ROOT  # noqa: F401
from api_docs.credentials import credential_summary, format_credentials, parse_credentials


class CredentialTests(unittest.TestCase):
    def test_parses_browser_curl_without_returning_values_in_summary(self) -> None:
        source = (
            "curl 'https://ieb.example.test/index' "
            "-H 'Cookie: tracking=ignored; JSESSIONID=session-value; iebJSid=browser-value'"
        )
        cookies = parse_credentials(source)
        self.assertEqual(cookies, {"JSESSIONID": "session-value", "iebJSid": "browser-value"})
        summary = credential_summary(cookies)
        self.assertTrue(summary["ready"])
        self.assertNotIn("session-value", str(summary))
        self.assertNotIn("browser-value", str(summary))

    def test_parses_windows_curl_cookie_header(self) -> None:
        source = (
            'curl ^"https://ieb.example.test/index^" ^\n'
            '  -H ^"cookie: JSESSIONID=session-value; iebJSid=browser-value^"'
        )
        self.assertEqual(
            parse_credentials(source),
            {"JSESSIONID": "session-value", "iebJSid": "browser-value"},
        )

    def test_rejects_incomplete_credentials(self) -> None:
        with self.assertRaisesRegex(ValueError, "iebJSid"):
            parse_credentials("Cookie: JSESSIONID=session-value")

    def test_formats_only_required_credentials_in_stable_order(self) -> None:
        self.assertEqual(
            format_credentials({
                "iebJSid": "browser-value",
                "tracking": "ignored",
                "JSESSIONID": "session-value",
            }),
            "JSESSIONID=session-value; iebJSid=browser-value",
        )


if __name__ == "__main__":
    unittest.main()
