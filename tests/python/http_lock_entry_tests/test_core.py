from __future__ import annotations

import unittest
from datetime import datetime
from io import BytesIO

from openpyxl import Workbook

from .common import APP_DIR, ENTRY_HTML  # noqa: F401
from http_lock_entry.credentials import credential_summary, parse_credentials
from http_lock_entry.input_data import normalize_business_date, parse_excel
from http_lock_entry.metadata import parse_portal_metadata


class HttpLockEntryCoreTest(unittest.TestCase):
    def test_credentials_keep_only_required_cookies_and_summary_has_no_values(self):
        source = (
            "curl 'https://ieb.csair.com/index/index' "
            "-H 'Cookie: ignored=abc; JSESSIONID=session-secret; iebJSid=ieb-secret'"
        )
        cookies = parse_credentials(source)
        self.assertEqual(cookies, {"JSESSIONID": "session-secret", "iebJSid": "ieb-secret"})
        summary = credential_summary(cookies)
        self.assertEqual(summary["cookieCount"], 2)
        self.assertNotIn("session-secret", str(summary))
        self.assertNotIn("ieb-secret", str(summary))

    def test_dynamic_metadata_and_default_reason_prefix_are_parsed(self):
        metadata = parse_portal_metadata(ENTRY_HTML)
        self.assertEqual(metadata.lock_types["BS_STUDY"].date_split_flag, "0")
        self.assertTrue(metadata.lock_types["RECU_LVE"].limit_flag == "1")
        self.assertEqual(metadata.default_reason_prefix, "测试操作员(900000):")

    def test_excel_dates_are_normalized_at_read_boundary(self):
        metadata = parse_portal_metadata(ENTRY_HTML)
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["员工号", "姓名", "锁班类型", "开始日期", "结束日期"])
        sheet.append([900001, "测试甲", "BS_STUDY-业务学习", datetime(2026, 10, 8), 46304])
        stream = BytesIO()
        workbook.save(stream)
        workbook.close()

        records, errors = parse_excel(stream.getvalue(), metadata, "original")
        self.assertEqual(errors, [])
        self.assertEqual(records[0]["员工号"], "900001")
        self.assertEqual(records[0]["开始日期"], "2026-10-08")
        self.assertRegex(records[0]["结束日期"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertEqual(normalize_business_date("10/8/26"), "")


if __name__ == "__main__":
    unittest.main()
