from __future__ import annotations

import unittest
from datetime import date
from pathlib import Path
import tempfile

from openpyxl import Workbook

from .common import APP_DIR  # noqa: F401; ensures the app modules are importable
from flight_stats.input_data import parse_pasted_records, read_excel_records


class FlightStatsInputTest(unittest.TestCase):
    def test_pasted_input_reads_standard_dates_and_reports_invalid_rows(self):
        records, errors = parse_pasted_records(
            "000001 测试甲 2025/02/27 2026/08/18\n无效数据",
            today=date(2026, 8, 18),
        )

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].employee_id, "000001")
        self.assertEqual(records[0].name, "测试甲")
        self.assertEqual(records[0].start_date, date(2025, 2, 27))
        self.assertEqual(records[0].end_date, date(2026, 8, 18))
        self.assertEqual(len(errors), 1)

    def test_excel_input_maps_headers_instead_of_fixed_columns(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.xlsx"
            workbook = Workbook()
            worksheet = workbook.active
            worksheet.append(["姓名", "截止时间", "员工号", "起始时间"])
            worksheet.append(["测试甲", "2026-08-18", "000001", "2025/2/27"])
            workbook.save(path)
            workbook.close()

            records, errors = read_excel_records(path, today=date(2026, 8, 18))

            self.assertEqual(errors, [])
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0].employee_id, "000001")
            self.assertEqual(records[0].start_date, date(2025, 2, 27))
            self.assertEqual(records[0].end_date, date(2026, 8, 18))


if __name__ == "__main__":
    unittest.main()
