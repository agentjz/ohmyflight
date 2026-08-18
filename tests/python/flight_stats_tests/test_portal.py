from __future__ import annotations

import unittest

from .common import APP_DIR  # noqa: F401; ensures the app modules are importable
from flight_stats.portal import parse_result_table


class FlightStatsPortalTest(unittest.TestCase):
    def test_result_table_uses_visible_headers_and_ignores_absent_fields(self):
        result = parse_result_table(
            {
                "headers": ["员工号", "姓名", "飞行时间", "飞行经历", "左座经历", "起落总数"],
                "rows": [["000001", "测试甲", "1269:08", "613:59", "0", "20"]],
            },
            expected_employee_id="000001",
            expected_name="测试甲",
        )

        self.assertEqual(
            result.headers,
            ["员工号", "姓名", "飞行时间", "飞行经历", "左座经历", "起落总数"],
        )
        self.assertEqual(result.values["飞行时间"], "1269:08")
        self.assertNotIn("昼间起落", result.values)
        self.assertNotIn("夜间起落", result.values)

    def test_result_table_rejects_employee_mismatch(self):
        with self.assertRaisesRegex(ValueError, "员工号不匹配"):
            parse_result_table(
                {
                    "headers": ["员工号", "姓名", "飞行时间"],
                    "rows": [["000002", "测试乙", "100:00"]],
                },
                expected_employee_id="000001",
                expected_name="测试甲",
            )


if __name__ == "__main__":
    unittest.main()
