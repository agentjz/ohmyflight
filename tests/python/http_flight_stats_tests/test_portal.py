from __future__ import annotations

import unittest
from datetime import date

from .common import APP_ROOT  # noqa: F401
from http_flight_stats.models import QueryRecord
from http_flight_stats.portal_client import build_query_params, parse_result_table


RESULT_HTML = """
<table class="table table-bordered">
  <thead><tr>
    <th>员工号</th><th>姓名</th><th>飞行时间</th><th>飞行经历</th>
    <th>左座经历</th><th>起落总数</th><th>航线起落</th>
  </tr></thead>
  <tbody class="list"><tr>
    <td>100001</td><td>测试甲</td><td>120:35</td><td>80:20</td>
    <td>40:15</td><td>36</td><td>30</td>
  </tr></tbody>
</table>
"""


class PortalTests(unittest.TestCase):
    def test_parses_dynamic_headers_and_exact_identity(self) -> None:
        result = parse_result_table(RESULT_HTML, "100001", "测试甲")

        self.assertEqual(
            result.headers,
            ["员工号", "姓名", "飞行时间", "飞行经历", "左座经历", "起落总数", "航线起落"],
        )
        self.assertEqual(result.values["飞行时间"], "120:35")
        self.assertEqual(result.values["起落总数"], "36")

    def test_rejects_response_for_another_employee(self) -> None:
        with self.assertRaisesRegex(ValueError, "员工号不匹配"):
            parse_result_table(RESULT_HTML, "100002", "测试乙")

    def test_builds_one_daily_query_for_all_result_fields(self) -> None:
        record = QueryRecord("100001", "测试甲", date(2025, 1, 2), date(2025, 3, 4), "测试")

        params = build_query_params(record)

        self.assertEqual(params["staffNum"], "100001")
        self.assertEqual(params["dateType"], "5")
        self.assertEqual(params["startStr"], "2025-01-02")
        self.assertEqual(params["endStr"], "2025-03-04")
        self.assertNotIn("scope", params)


if __name__ == "__main__":
    unittest.main()

