from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

from .common import APP_DIR  # noqa: F401
from qualification_query.input_data import parse_pasted_records, read_excel_records


class QualificationInputTest(unittest.TestCase):
    def test_paste_accepts_employee_id_and_optional_name(self):
        records, errors = parse_pasted_records("000001 测试甲\n000002\n无效行\n000001 重复")

        self.assertEqual([(item.employee_id, item.name) for item in records], [("000001", "测试甲"), ("000002", "")])
        self.assertEqual(len(errors), 2)
        self.assertIn("未识别六位员工号", str(errors[0]))
        self.assertIn("重复员工号", str(errors[1]))

    def test_excel_maps_headers_and_reports_invalid_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input.xlsx"
            workbook = Workbook()
            worksheet = workbook.active
            worksheet.append(["姓名", "工号"])
            worksheet.append(["测试甲", 1])
            worksheet.append(["测试乙", "000002"])
            worksheet.append(["无效", "ABC"])
            workbook.save(path)
            workbook.close()

            records, errors = read_excel_records(path)

            self.assertEqual([(item.employee_id, item.name) for item in records], [("000001", "测试甲"), ("000002", "测试乙")])
            self.assertEqual(len(errors), 1)
            self.assertIn("员工号不是六位数字", str(errors[0]))


if __name__ == "__main__":
    unittest.main()
