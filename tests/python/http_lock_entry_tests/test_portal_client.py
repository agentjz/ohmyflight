from __future__ import annotations

import unittest

from .common import APP_DIR, CONFLICT_HTML, ENTRY_HTML, SUCCESS_HTML  # noqa: F401
from http_lock_entry.metadata import parse_portal_metadata
from http_lock_entry.models import EmployeeIdentity
from http_lock_entry.portal_client import PortalClient, PortalSessionExpired


class FakeResponse:
    def __init__(self, text="", json_value=None, url="https://ieb.csair.com/ok", status=200):
        self.text = text
        self._json_value = json_value
        self.url = url
        self.status_code = status
        self.history = []

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._json_value


class FakeCookies:
    def __init__(self):
        self.values = {}

    def clear(self):
        self.values.clear()

    def set(self, name, value, **_kwargs):
        self.values[name] = value


class FakeSession:
    def __init__(self, get_responses=None, post_responses=None):
        self.headers = {}
        self.cookies = FakeCookies()
        self.get_responses = list(get_responses or [])
        self.post_responses = list(post_responses or [])
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append(("GET", url, kwargs))
        return self.get_responses.pop(0)

    def post(self, url, **kwargs):
        self.calls.append(("POST", url, kwargs))
        return self.post_responses.pop(0)


class HttpPortalClientTest(unittest.TestCase):
    def make_client(self, session=None):
        return PortalClient(session=session or FakeSession())

    def test_verify_credentials_requires_real_entry_form(self):
        session = FakeSession(get_responses=[FakeResponse("<html>login</html>", url="https://ieb.csair.com/login")])
        client = self.make_client(session)
        with self.assertRaises(PortalSessionExpired):
            client.load_credentials("JSESSIONID=a; iebJSid=b")

    def test_employee_validation_uses_staff_num_with_capital_n(self):
        session = FakeSession(
            get_responses=[FakeResponse(ENTRY_HTML)],
            post_responses=[FakeResponse(json_value={
                "permissionFlag": "true", "nameInfo": "测试甲", "deptInfo": "测试部门"
            })],
        )
        client = self.make_client(session)
        client.load_credentials("JSESSIONID=a; iebJSid=b")
        identity = client.validate_employee("900001")
        self.assertEqual(identity.name, "测试甲")
        body = session.calls[-1][2]["data"]
        self.assertEqual(body["staffNum"], "900001")
        self.assertNotIn("staffnum", body)

    def test_monthly_submit_body_preserves_repeated_days(self):
        session = FakeSession(get_responses=[FakeResponse(ENTRY_HTML)])
        client = self.make_client(session)
        metadata = client.load_credentials("JSESSIONID=a; iebJSid=b")
        record = {
            "员工号": "900001", "姓名": "测试甲", "请假类型": "BS_STUDY",
            "时间模式": 2, "月份": "2026-10", "日期列表": [3, 11, 26],
            "开始时间": "08:17", "结束时间": "18:43", "备注": "批量测试",
            "开始日期": "", "结束日期": "",
        }
        body = client.build_submit_data(
            record,
            EmployeeIdentity("900001", "测试甲", "测试部门"),
            metadata.lock_types["BS_STUDY"],
            "批量测试",
        )
        self.assertEqual([value for key, value in body if key == "lockDaysNum"], ["3", "11", "26"])
        self.assertIn(("lockTimeType", "2"), body)
        self.assertIn(("lockDays", "3"), body)

    def test_submit_result_requires_exact_employee_type_and_minutes(self):
        client = self.make_client()
        client.metadata = parse_portal_metadata(ENTRY_HTML)
        result = client.parse_submit_result(SUCCESS_HTML)
        record = {
            "员工号": "900001", "请假类型": "BS_STUDY", "时间模式": 1,
            "开始日期": "2026-10-08", "结束日期": "2026-10-08",
            "开始时间": "08:17", "结束时间": "18:43",
        }
        identity = EmployeeIdentity("900001", "测试甲", "测试部门")
        matched, problem = client.attribute_submit_result(result, record, identity)
        self.assertEqual(problem, "")
        self.assertEqual(len(matched), 1)

        wrong_record = {**record, "开始时间": "08:18"}
        matched, problem = client.attribute_submit_result(result, wrong_record, identity)
        self.assertEqual(matched, [])
        self.assertIn("精确归属", problem)

    def test_conflict_table_is_not_reported_as_success(self):
        client = self.make_client()
        result = client.parse_submit_result(CONFLICT_HTML)
        self.assertEqual(result.result_rows, [])
        self.assertEqual(len(result.conflict_rows), 1)

    def test_quota_table_is_parsed_by_header_name(self):
        html = """
        <div class="hDiv"><table><tr>
          <th>休假类型</th><th>年份</th><th>休假天数</th><th>锁班天数</th><th>解锁天数</th><th>可休天数</th>
        </tr></table></div>
        <div class="bDiv"><table><tbody><tr>
          <td>健康疗养</td><td>2026</td><td>8</td><td>2</td><td>0</td><td>6</td>
        </tr></tbody></table></div>
        """
        rows = self.make_client().parse_quota_result(html)
        self.assertEqual(rows[0]["年份"], "2026")
        self.assertEqual(rows[0]["可休天数"], "6")

    def test_query_pagination_keeps_checkbox_record_id(self):
        def query_html(record_id, page_link=""):
            return f"""
            <div class="flexigrid">
              <div class="hDiv"><table><tr>
                <th>选择</th><th>序号</th><th>状态</th><th>员工号</th><th>姓名</th>
                <th>开始日期</th><th>结束日期</th><th>锁班类型</th><th>录入时间</th>
              </tr></table></div>
              <div class="bDiv"><table><tbody><tr>
                <td><input type="checkbox" value="{record_id}"></td><td>1</td><td>已锁</td>
                <td>900001</td><td>测试甲</td><td>2026-10-08 08:00:00</td>
                <td>2026-10-08 20:00:00</td><td>业务学习</td><td>2026-09-01</td>
              </tr></tbody></table></div>{page_link}
            </div>
            """

        session = FakeSession(
            post_responses=[
                FakeResponse(query_html("record-a", "<a href=\"javascript:goPageTwo('x','y','z','2');\">最后一页</a>")),
            ],
            get_responses=[FakeResponse(query_html("record-b"))],
        )
        rows = self.make_client(session).query_records("900001", "已锁")
        self.assertEqual([row["记录ID"] for row in rows], ["record-a", "record-b"])
        self.assertEqual(session.calls[0][2]["data"]["lockStatus"], "1")
        self.assertEqual(session.calls[1][0], "GET")
        self.assertEqual(session.calls[1][2]["params"]["page"], "2")

    def test_query_preserves_blank_selection_header_alignment(self):
        html = """
        <div class="flexigrid"><div class="hDiv"><table><tr>
          <th></th><th>序号</th><th>状态</th><th>员工号</th><th>姓名</th>
          <th>开始日期</th><th>结束日期</th><th>锁班类型</th>
        </tr></table></div><div class="bDiv"><table><tbody class="list"><tr>
          <td><input type="checkbox" value="record-approve"></td><td>123</td><td>待审批</td>
          <td>900001</td><td>测试甲</td><td>2026-10-01 08:59:00</td>
          <td>2026-10-01 19:59:00</td><td>BS_STUDY</td>
        </tr></tbody></table></div><div class="footer"><a href="javascript:goPageTwo('x','y','z','1');">最后一页</a></div></div>
        """
        rows, pages = self.make_client().parse_query_result(html)
        self.assertEqual(pages, 1)
        self.assertEqual(rows[0]["状态"], "待审批")
        self.assertEqual(rows[0]["员工号"], "900001")
        self.assertEqual(rows[0]["记录ID"], "record-approve")

    def test_approve_records_requires_locked_and_pending_recheck(self):
        row = {
            "记录ID": "record-approve", "状态": "待审批", "员工号": "900001", "姓名": "测试甲",
            "开始日期": "2026-10-01 08:59:00", "结束日期": "2026-10-01 19:59:00",
            "锁班类型": "BS_STUDY", "录入时间": "2026-08-19",
        }
        client = self.make_client()
        calls = []
        client.perform_state_action = lambda action, rows, reason: calls.append((action, rows, reason)) or "通过成功"
        client.query_records = lambda employee_id, status: [{**row, "状态": "已锁"}] if status == "已锁" else []
        self.assertEqual(client.approve_records([row], "by agent"), "通过成功")
        self.assertEqual(calls[0][0], "approve")

    def test_approve_state_action_posts_repeated_ids_and_query_fields(self):
        session = FakeSession(post_responses=[FakeResponse(json_value={"success": "true", "successMsg": "通过成功"})])
        client = self.make_client(session)
        rows = [{"记录ID": "record-a", "员工号": "900001"}, {"记录ID": "record-b", "员工号": "900001"}]
        self.assertEqual(client.perform_state_action("approve", rows, "by agent"), "通过成功")
        method, url, kwargs = session.calls[0]
        self.assertTrue(url.endswith("/newieb/nonproductionTask/importNonproductionTaskLockListToSoc"))
        body = kwargs["data"]
        self.assertEqual([value for key, value in body if key == "ids"], ["record-a", "record-b"])
        self.assertIn(("approveRemark", "by agent"), body)
        self.assertIn(("lockStatus", ""), body)


if __name__ == "__main__":
    unittest.main()
