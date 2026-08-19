from __future__ import annotations

import unittest

from .common import APP_DIR  # noqa: F401
from qualification_query.credentials import browser_cookies, parse_credentials


class QualificationCredentialsTest(unittest.TestCase):
    def test_parses_cookie_header_without_returning_source_text(self):
        source = "Cookie: tracking=abc; iebJSid=session-a; JSESSIONID=session-b"
        parsed = parse_credentials(source)

        self.assertEqual(parsed["iebJSid"], "session-a")
        self.assertEqual(parsed["JSESSIONID"], "session-b")
        self.assertNotIn("Cookie:", repr(parsed))
        cookies = browser_cookies(parsed)
        self.assertTrue(all(item["url"] == "https://ieb.csair.com/" for item in cookies))

    def test_requires_both_portal_session_cookies(self):
        with self.assertRaisesRegex(ValueError, "JSESSIONID"):
            parse_credentials("iebJSid=session-a")


if __name__ == "__main__":
    unittest.main()

