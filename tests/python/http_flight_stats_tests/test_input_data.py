from __future__ import annotations

import tempfile
import unittest
from datetime import date
from pathlib import Path

from openpyxl import Workbook

from .common import APP_ROOT  # noqa: F401
from http_flight_stats.input_data import parse_pasted_records, read_excel_records


class InputDataTests(unittest.TestCase):
    def test_reads_existing_header_aliases_and_skips_duplicate_employee(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.xlsx"
            workbook = Workbook()
            sheet = workbook.active
            sheet.append(["员工号", "姓名", "起始时间", "截止时间"])
            sheet.append([100001, "测试甲", date(2025, 1, 1), date(2025, 2, 1)])
            sheet.append([100001, "测试甲", date(2025, 1, 1), date(2025, 2, 1)])
            workbook.save(path)
            workbook.close()

            records, errors = read_excel_records(path)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].employee_id, "100001")
        self.assertEqual(len(errors), 1)
        self.assertIn("重复员工号", errors[0])

    def test_pasted_input_uses_one_date_as_both_boundaries(self) -> None:
        records, errors = parse_pasted_records("100002 测试乙 2025/03/04")

        self.assertEqual(errors, [])
        self.assertEqual(records[0].start_date, date(2025, 3, 4))
        self.assertEqual(records[0].end_date, date(2025, 3, 4))


if __name__ == "__main__":
    unittest.main()

