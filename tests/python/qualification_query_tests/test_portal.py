from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

from .common import APP_DIR  # noqa: F401
from qualification_query.models import QueryRecord
from qualification_query.portal import OPERATION_HEADERS, TECHNICAL_HEADERS, PortalClient


class QualificationPortalTest(unittest.TestCase):
    def test_query_reads_both_existing_tables_and_closes_dialog(self):
        client = PortalClient(MagicMock())
        record = QueryRecord(2, "000001", "测试甲", "第2行")
        technical = [{"技术等级代码": "CAP", "技术等级": "机长"}]
        operation = [{"类型": "区域航线资格", "运行资格代码": "R1", "运行资格": "区域资格"}]

        with (
            patch.object(client, "_search_employee", return_value="测试甲"),
            patch.object(client, "_read_tab", side_effect=[technical, operation]) as read_tab,
            patch.object(client, "_close_person_dialog") as close_dialog,
        ):
            result = client.query(record)

        self.assertEqual(result.page_name, "测试甲")
        self.assertEqual(result.technical_rows, technical)
        self.assertEqual(result.operation_rows, operation)
        self.assertEqual(read_tab.call_args_list[0].args, ("技术等级", "#qualList", TECHNICAL_HEADERS))
        self.assertEqual(read_tab.call_args_list[1].args, ("运行资格", "#showSingleEmpOperQualList", OPERATION_HEADERS))
        close_dialog.assert_called_once()

    def test_dialog_is_closed_when_a_table_fails(self):
        client = PortalClient(MagicMock())
        record = QueryRecord(2, "000001", "测试甲", "第2行")
        with (
            patch.object(client, "_search_employee", return_value="测试甲"),
            patch.object(client, "_read_tab", side_effect=RuntimeError("表头异常")),
            patch.object(client, "_close_person_dialog") as close_dialog,
        ):
            with self.assertRaisesRegex(RuntimeError, "表头异常"):
                client.query(record)
        close_dialog.assert_called_once()


if __name__ == "__main__":
    unittest.main()
